import { listApiKeys } from "../auth/apiKeys.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAdmin } from "../auth/middleware.js";

export async function userRoutes(app: FastifyInstance) {
  app.get("/api/users", { preHandler: requireAdmin }, async () => {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.role, u.created_at, u.disabled_at,
              (SELECT count(*)::int FROM api_keys k WHERE k.user_id = u.id AND k.revoked_at IS NULL) AS active_keys
         FROM users u ORDER BY u.created_at`);
    return rows;
  });

  // An admin can see a member's keys (prefix only, never the key) in order to revoke them.
  app.get("/api/users/:id/keys", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/.test(id)) return reply.code(400).send({ error: "bad id" });
    return listApiKeys(id);
  });

  app.patch("/api/users/:id", { preHandler: requireAdmin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!/^[0-9a-f-]{36}$/.test(id)) return reply.code(400).send({ error: "bad id" });
    const b = z.object({
      disabled: z.boolean().optional(),
      role: z.enum(["admin", "member"]).optional(),
    }).refine((v) => v.disabled !== undefined || v.role !== undefined, "nothing to change").safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "send 'disabled' (boolean) and/or 'role' (admin|member)" });

    // An admin cannot change their own account, so at least one active admin always remains.
    if (id === req.user!.id) return reply.code(400).send({ error: "you cannot change your own role or status" });

    const { rows } = await pool.query(
      `UPDATE users SET
         disabled_at = CASE WHEN $2::boolean IS NULL THEN disabled_at
                            WHEN $2::boolean THEN COALESCE(disabled_at, now())
                            ELSE NULL END,
         role = COALESCE($3, role)
       WHERE id = $1
       RETURNING id, email, role, created_at, disabled_at`,
      [id, b.data.disabled ?? null, b.data.role ?? null]);
    return rows[0] ?? reply.code(404).send({ error: "user not found" });
  });
}
