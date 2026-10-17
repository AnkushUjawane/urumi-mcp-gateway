import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { verifyPassword } from "../auth/passwords.js";
import { makeSession, SESSION_COOKIE, SESSION_MAX_AGE_S } from "../auth/sessions.js";
import { requireSession } from "../auth/middleware.js";
import { createApiKey, listApiKeys, revokeApiKey } from "../auth/apiKeys.js";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "email and password required" });
    const { rows } = await pool.query(
      "SELECT id, email, role, password_hash FROM users WHERE email = $1 AND disabled_at IS NULL",
      [body.data.email]);
    const u = rows[0];
    // Same message for "no such user" and "wrong password", so the response doesn't reveal which emails exist.
    if (!u || !(await verifyPassword(body.data.password, u.password_hash)))
      return reply.code(401).send({ error: "invalid email or password" });
    reply.setCookie(SESSION_COOKIE, makeSession(u.id), {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE_S,
      secure: process.env.COOKIE_SECURE === "true",
    });
    return { id: u.id, email: u.email, role: u.role };
  });

  app.post("/api/auth/logout", async (_req, reply) => {
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/api/me", { preHandler: requireSession }, async (req) => req.user);

  // --- API keys: every user manages their own ---
  app.get("/api/keys", { preHandler: requireSession }, async (req) => listApiKeys(req.user!.id));

  app.post("/api/keys", { preHandler: requireSession }, async (req, reply) => {
    const body = z.object({ name: z.string().min(1).max(60) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "name required (max 60 chars)" });
    return createApiKey(req.user!.id, body.data.name);   // includes the full key, shown once
  });

  app.delete("/api/keys/:id", { preHandler: requireSession }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/.test(id)) return reply.code(400).send({ error: "bad id" });
    const ok = await revokeApiKey(id, req.user!.role === "admin" ? null : req.user!.id);
    return ok ? { revoked: true } : reply.code(404).send({ error: "key not found or already revoked" });
  });
}
