import type { FastifyReply, FastifyRequest } from "fastify";

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export async function originCheck(req: FastifyRequest, reply: FastifyReply) {
  if (!UNSAFE.has(req.method) || !req.url.startsWith("/api/")) return;
  const origin = req.headers.origin;
  if (!origin) return;                       // non-browser client
  let host = "";
  try { host = new URL(origin).host; } catch { /* handled below */ }
  if (!host || host !== req.headers.host) {
    return reply.code(403).send({ error: "cross-origin request blocked" });
  }
}
