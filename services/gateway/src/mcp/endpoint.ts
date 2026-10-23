import type { FastifyInstance } from "fastify";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { verifyApiKey } from "../auth/apiKeys.js";
import { listAggregatedTools } from "./aggregator.js";
import { callToolAs, recordAudit } from "./callTool.js";

export async function mcpEndpoint(app: FastifyInstance) {
  app.post("/mcp", async (req, reply) => {
    // 1. Authenticate with the user's gateway API key.
    const header = req.headers.authorization ?? "";
    const key = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!key) return reply.code(401).header("WWW-Authenticate", "Bearer").send({ error: "missing API key" });

    const auth = await verifyApiKey(key);
    if (!auth.ok) {
      // A revoked key still identifies its owner, so the rejected attempt is logged under that user.
      // Unknown keys have no owner, so they are only logged to the console.
      if (auth.user) {
        await recordAudit({ user: auth.user, source: "mcp", server: null, tool: "(authentication)",
          ms: 0, status: "denied", message: `API key ${auth.reason}` });
      } else app.log.warn("mcp: unknown API key presented");
      // Same response for unknown, revoked and disabled: it doesn't reveal which keys exist.
      return reply.code(401).header("WWW-Authenticate", "Bearer").send({ error: "invalid or revoked API key" });
    }
    const user = { id: auth.user.id, email: auth.user.email };

    // 2. A fresh server per request (stateless): any gateway replica can answer any request.
    const server = new Server({ name: "urumi-gateway", version: "0.1.0" }, { capabilities: { tools: {} } });

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: listAggregatedTools().map((t) => ({
        name: t.name, description: t.description, inputSchema: t.inputSchema,
      })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) =>
      (await callToolAs(user, "mcp", request.params.name, request.params.arguments ?? {})) as any);

    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    // We hand the raw Node response to the MCP transport, so Fastify must not touch it.
    reply.hijack();
    reply.raw.on("close", () => { transport.close(); server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req.raw, reply.raw, req.body);
    } catch (e: any) {
      app.log.error(`mcp request failed: ${e?.message ?? e}`);
      if (!reply.raw.headersSent) {
        reply.raw.writeHead(500, { "Content-Type": "application/json" });
        reply.raw.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
      }
    }
  });

  // Stateless server: no GET (server-push stream) and no DELETE (session close).
  const notAllowed = async (_req: unknown, reply: any) =>
    reply.code(405).header("Allow", "POST").send({ error: "method not allowed" });
  app.get("/mcp", notAllowed);
  app.delete("/mcp", notAllowed);
}
