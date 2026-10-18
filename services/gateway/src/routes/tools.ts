import type { FastifyInstance } from "fastify";
import { requireAdmin, requireSession } from "../auth/middleware.js";
import { getEntry, refreshAll } from "../mcp/manager.js";
import { pool } from "../db.js";

export async function toolRoutes(app: FastifyInstance) {
  // Tools of one server (from the cache; no upstream call is made).
  app.get("/api/servers/:id/tools", { preHandler: requireSession }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/.test(id)) return reply.code(400).send({ error: "bad id" });
    const row = (await pool.query("SELECT slug, enabled FROM servers WHERE id=$1", [id])).rows[0];
    if (!row) return reply.code(404).send({ error: "server not found" });
    if (!row.enabled) return { status: "disabled", tools: [] };
    const e = getEntry(row.slug);
    if (!e) return { status: "unknown", tools: [] };
    return { status: e.status, reason: e.reason, checked_at: e.checkedAt,
             tools: e.tools.map((t) => ({ name: t.name, description: t.description })) };
  });

  // Force a refresh now (useful for tests and an admin "Refresh" button).
  app.post("/api/servers/refresh", { preHandler: requireAdmin }, async () => {
    await refreshAll();
    return { refreshed: true };
  });
}
