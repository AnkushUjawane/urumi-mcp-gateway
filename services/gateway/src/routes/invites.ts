import type { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";
import { hashPassword } from "../auth/passwords.js";
import { makeSession, SESSION_COOKIE, SESSION_MAX_AGE_S } from "../auth/sessions.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const INVITE_TTL_HOURS = 48;
const UUID = /^[0-9a-f-]{36}$/;

export async function inviteRoutes(app: FastifyInstance) {
  // --- admin: create an invite. The token is returned ONCE; only its hash is stored. ---
  app.post("/api/invites", { preHandler: requireAdmin }, async (req, reply) => {
    const b = z.object({
      email: z.string().email().max(200),
      role: z.enum(["admin", "member"]).default("member"),
    }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "valid email required; role is admin or member" });
    const email = b.data.email.toLowerCase();

    const exists = await pool.query("SELECT 1 FROM users WHERE lower(email) = $1", [email]);
    if (exists.rowCount) return reply.code(409).send({ error: "a user with this email already exists" });

    // A new invite replaces any older pending invite for the same email.
    await pool.query("DELETE FROM invites WHERE lower(email) = $1 AND used_at IS NULL", [email]);

    const token = randomBytes(32).toString("base64url");
    const { rows } = await pool.query(
      `INSERT INTO invites (email, role, token_hash, expires_at, created_by)
       VALUES ($1, $2, $3, now() + make_interval(hours => $4::int), $5)
       RETURNING id, email, role, expires_at`,
      [email, b.data.role, sha256(token), INVITE_TTL_HOURS, req.user!.id]);
    // The dashboard builds the full link from its own origin.
    return reply.code(201).send({ ...rows[0], token, path: `/accept-invite?token=${token}` });
  });

  // --- admin: pending invites (never includes the token or its hash) ---
  app.get("/api/invites", { preHandler: requireAdmin }, async () => {
    const { rows } = await pool.query(
      `SELECT id, email, role, expires_at FROM invites
        WHERE used_at IS NULL AND expires_at > now() ORDER BY expires_at`);
    return rows;
  });

  app.delete("/api/invites/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID.test(id)) return reply.code(400).send({ error: "bad id" });
    const { rowCount } = await pool.query("DELETE FROM invites WHERE id = $1 AND used_at IS NULL", [id]);
    return rowCount ? { deleted: true } : reply.code(404).send({ error: "invite not found" });
  });

  // --- public: lets the accept page show which email it is for ---
  app.get("/api/auth/invite-info", async (req, reply) => {
    const q = z.object({ token: z.string().min(20).max(100) }).safeParse(req.query);
    // One answer for invalid, expired and used tokens, so nothing about them leaks.
    const notFound = () => reply.code(404).send({ error: "invite is invalid or has expired" });
    if (!q.success) return notFound();
    const { rows } = await pool.query(
      "SELECT email, role FROM invites WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()",
      [sha256(q.data.token)]);
    return rows[0] ?? notFound();
  });

  // --- public: accept an invite, set a password, and get logged in ---
  app.post("/api/auth/accept-invite", async (req, reply) => {
    const b = z.object({
      token: z.string().min(20).max(100),
      password: z.string().min(8, "password must be at least 8 characters").max(200),
    }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: b.error.issues.map((i) => i.message).join("; ") });

    // Hash BEFORE opening the transaction: scrypt is slow and we don't want to hold a DB connection during it.
    const pwHash = await hashPassword(b.data.password);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Atomic single use: only one concurrent request can flip used_at from NULL.
      const inv = (await client.query(
        `UPDATE invites SET used_at = now()
          WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
          RETURNING email, role`, [sha256(b.data.token)])).rows[0];
      if (!inv) {
        await client.query("ROLLBACK");
        return reply.code(400).send({ error: "invite is invalid or has expired" });
      }
      const user = (await client.query(
        `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING RETURNING id, email, role`,
        [inv.email, pwHash, inv.role])).rows[0];
      if (!user) {
        await client.query("ROLLBACK");               // the invite is NOT consumed
        return reply.code(409).send({ error: "a user with this email already exists" });
      }
      await client.query("COMMIT");
      reply.setCookie(SESSION_COOKIE, makeSession(user.id), {
        httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_S,
        secure: process.env.COOKIE_SECURE === "true",
      });
      return user;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  });
}
