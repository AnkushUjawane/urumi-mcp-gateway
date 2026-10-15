import { createServer, type IncomingMessage } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";

const PORT = Number(process.env.PORT ?? 3000);
const SERVER_NAME = process.env.SERVER_NAME ?? "utils-mcp";
// If AUTH_TOKEN is set, every /mcp request must carry "Authorization: Bearer <token>".
const AUTH_TOKEN = process.env.AUTH_TOKEN;

const sha = (s: string) => createHash("sha256").update(s).digest();
function authorized(req: IncomingMessage): boolean {
  if (!AUTH_TOKEN) return true;
  const header = req.headers.authorization ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  // hash both sides so lengths match, then compare in constant time
  return timingSafeEqual(sha(given), sha(AUTH_TOKEN));
}

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

  if (path === "/healthz") { res.writeHead(200).end("ok"); return; }   // no auth: kubelet probes use it

  if (path === "/mcp") {
    if (!authorized(req)) {
      res.writeHead(401, { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end("Method not allowed"); return; }
    try {
      const body = await readBody(req);
      const server = new McpServer({ name: SERVER_NAME, version: "0.1.0" });
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

httpServer.listen(PORT, () => console.log(`${SERVER_NAME} listening on :${PORT} (auth ${AUTH_TOKEN ? "ON" : "OFF"})`));
