import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { requireSession } from "../auth/middleware.js";

export async function auditRoutes(app: FastifyInstance) {
  app.get("/api/audit", { preHandler: requireSession }, async (req, reply) => {
    const q = z.object({
      limit: z.coerce.number().int().min(1).max(200).default(50),
      before: z.coerce.number().int().optional(),            // cursor: rows with id < before
      status: z.enum(["ok", "error", "timeout", "denied"]).optional(),
      server: z.string().max(30).optional(),
    }).safeParse(req.query);
    if (!q.success) return reply.code(400).send({ error: "bad query" });

    const where: string[] = [];
    const params: unknown[] = [];
    const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };

    // Members see only their own calls. This is enforced here, in the query, not in the UI.
    if (req.user!.role !== "admin") add("user_id = ?", req.user!.id);
    if (q.data.before) add("id < ?", q.data.before);
    if (q.data.status) add("status = ?", q.data.status);
    if (q.data.server) add("server_slug = ?", q.data.server);
    params.push(q.data.limit);

    const { rows } = await pool.query(
      `SELECT id, ts, user_email, source, server_slug, tool, duration_ms, status, error_message
         FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""}
        ORDER BY id DESC LIMIT $${params.length}`, params);
    return { rows, next_before: rows.length === q.data.limit ? rows[rows.length - 1].id : null };
  });
}
