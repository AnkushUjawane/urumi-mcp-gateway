import { createServer, type IncomingMessage } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.PORT ?? 3000);

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (c) => { raw += c; if (raw.length > 1_000_000) reject(new Error("body too large")); });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : undefined); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const httpServer = createServer(async (req, res) => {
  const path = (req.url ?? "").split("?")[0];

  if (path === "/healthz") { res.writeHead(200).end("ok"); return; }

  if (path === "/mcp") {
    // Stateless mode: no session IDs, and a fresh server + transport for every request.
    // Any replica can answer any request.
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end("Method not allowed (stateless server)");
      return;
    }
    try {
      const body = await readBody(req);
      const server = new McpServer({ name: "woo-mcp", version: "0.1.0" });
      registerTools(server);
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      res.on("close", () => { transport.close(); server.close(); });
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (e: any) {
      console.error("mcp request failed:", e?.message ?? e);
      if (!res.headersSent) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Bad request" }, id: null }));
      }
    }
    return;
  }

  res.writeHead(404).end("not found");
});

httpServer.listen(PORT, () => console.log(`woo-mcp listening on :${PORT} (POST /mcp, GET /healthz)`));
