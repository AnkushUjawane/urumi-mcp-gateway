import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireSession } from "../auth/middleware.js";
import { describeProviders } from "../chat/providers.js";
import { runAgent, type AgentEvent } from "../chat/agent.js";

const bodySchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(4000),
  })).min(1).max(20),
}).refine((b) => b.messages[b.messages.length - 1].role === "user", "last message must be from the user");

const running = new Set<string>();   // user ids with a chat run in progress (per gateway replica)

export async function chatRoutes(app: FastifyInstance) {
  // Is chat usable? Lets the dashboard show a clear message instead of failing on the first question.
  app.get("/api/chat/status", { preHandler: requireSession }, async () => {
    const providers = describeProviders();
    return { enabled: providers.length > 0, providers };
  });

  app.post("/api/chat", { preHandler: requireSession }, async (req, reply) => {
    const body = bodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "send {messages:[{role,content}]} (max 20, last from user)" });
    if (describeProviders().length === 0) return reply.code(503).send({ error: "chat is not configured (no LLM key)" });

    const user = { id: req.user!.id, email: req.user!.email, role: req.user!.role };
    if (running.has(user.id)) return reply.code(429).send({ error: "a chat request is already running; wait for it to finish" });
    running.add(user.id);

    // We write the stream ourselves, so Fastify must not touch the response.
    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    let closed = false;
    res.on("close", () => { closed = true; });
    const send = (e: AgentEvent) => { if (!closed) res.write(`data: ${JSON.stringify(e)}\n\n`); };
    const ping = setInterval(() => { if (!closed) res.write(": keep-alive\n\n"); }, 15_000);

    try {
      await runAgent(user, body.data.messages, send);
    } catch {
      send({ type: "error", message: "The assistant failed unexpectedly." });
    } finally {
      clearInterval(ping);
      running.delete(user.id);
      if (!closed) res.end();
    }
  });
}
