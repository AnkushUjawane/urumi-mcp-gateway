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
}
