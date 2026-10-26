import { requireAdmin } from "../auth/middleware.js";
import { chatCompletion, LlmError } from "../chat/llm.js";
import type { FastifyInstance } from "fastify";
import { requireSession } from "../auth/middleware.js";
import { describeProviders } from "../chat/providers.js";

export async function chatRoutes(app: FastifyInstance) {
  // Is chat usable? Lets the dashboard show a clear message instead of failing on the first question.
  app.get("/api/chat/status", { preHandler: requireSession }, async () => {
    const providers = describeProviders();
    return { enabled: providers.length > 0, providers };
  });
  // POST /api/chat (the tool loop) is added in step 6.4.
    // TEMPORARY: raw LLM test, removed in 6.4
  app.post("/api/chat/_debug", { preHandler: requireAdmin }, async (req, reply) => {
    const prompt = String((req.body as any)?.prompt ?? "Say hello in five words.").slice(0, 500);
    const t = Date.now();
    try {
      const r = await chatCompletion([{ role: "user", content: prompt }], []);
      return { provider: r.provider, model: r.model, ms: Date.now() - t, reply: r.message.content };
    } catch (e) {
      return reply.code(502).send({ error: e instanceof LlmError ? e.message : "LLM call failed" });
    }
  });
}
