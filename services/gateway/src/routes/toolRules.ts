import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";

const PATTERN = /^[a-z0-9-]{1,24}__[A-Za-z0-9_-]{0,60}\*?$/;

export async function toolRuleRoutes(app: FastifyInstance) {
  app.get("/api/tool-rules", { preHandler: requireAdmin }, async () =>
    (await pool.query("SELECT id, role, pattern, created_at FROM tool_rules ORDER BY pattern")).rows);

  app.post("/api/tool-rules", { preHandler: requireAdmin }, async (req, reply) => {
    const b = z.object({ role: z.literal("member").default("member"), pattern: z.string().regex(PATTERN) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "pattern must look like 'server__tool' or 'server__prefix*'" });
    const r = await pool.query(
      "INSERT INTO tool_rules (role, pattern) VALUES ($1,$2) ON CONFLICT DO NOTHING RETURNING id, role, pattern",
      [b.data.role, b.data.pattern]);
    return r.rows[0] ? reply.code(201).send(r.rows[0]) : reply.code(409).send({ error: "rule already exists" });
  });

  app.delete("/api/tool-rules/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/.test(id)) return reply.code(400).send({ error: "bad id" });
    const { rowCount } = await pool.query("DELETE FROM tool_rules WHERE id = $1", [id]);
    return rowCount ? { deleted: true } : reply.code(404).send({ error: "rule not found" });
  });
}
