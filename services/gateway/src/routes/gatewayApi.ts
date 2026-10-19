import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/middleware.js";
import { listAggregatedTools } from "../mcp/aggregator.js";
import { callToolAs } from "../mcp/callTool.js";

export async function gatewayApiRoutes(app: FastifyInstance) {
  // The merged tool list, exactly what an MCP client would see.
  app.get("/api/tools", { preHandler: requireSession }, async () =>
    listAggregatedTools().map((t) => ({ name: t.name, server: t.server, description: t.description })));

  // Runs a tool as the logged-in user. Used for testing now; the chat agent will call the same function.
  app.post("/api/tools/call", { preHandler: requireSession }, async (req, reply) => {
    const b = z.object({ name: z.string().min(1).max(100), arguments: z.record(z.string(), z.unknown()).default({}) }).safeParse(req.body);
    if (!b.success) return reply.code(400).send({ error: "name (string) and arguments (object) required" });
    return callToolAs({ id: req.user!.id, email: req.user!.email }, "api", b.data.name, b.data.arguments);
  });
}
