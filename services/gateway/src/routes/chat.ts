import { runAgent, type AgentEvent } from "../chat/agent.js";
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
  // TEMPORARY: non-streaming agent test, replaced in 6.4
  app.post("/api/chat/_test", { preHandler: requireSession }, async (req) => {
    const prompt = String((req.body as any)?.prompt ?? "").slice(0, 1000);
    const events: AgentEvent[] = [];
    await runAgent({ id: req.user!.id, email: req.user!.email }, [{ role: "user", content: prompt }], (e) => events.push(e));
    return events;
  });
}
