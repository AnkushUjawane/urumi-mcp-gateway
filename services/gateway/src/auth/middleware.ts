import type { FastifyReply, FastifyRequest } from "fastify";
import { pool } from "../db.js";
import { readSession, SESSION_COOKIE } from "./sessions.js";

export type AuthUser = { id: string; email: string; role: "admin" | "member" };
declare module "fastify" { interface FastifyRequest { user?: AuthUser } }

// Dashboard routes: identified by the session cookie.
export async function requireSession(req: FastifyRequest, reply: FastifyReply) {
  const uid = readSession(req.cookies[SESSION_COOKIE]);
  if (uid) {
    const { rows } = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1 AND disabled_at IS NULL", [uid]);
    if (rows[0]) { req.user = rows[0]; return; }
  }
  return reply.code(401).send({ error: "not authenticated" });
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  await requireSession(req, reply);
  if (reply.sent) return;
  if (req.user!.role !== "admin") return reply.code(403).send({ error: "admin only" });
}
