import { toolRuleRoutes } from "./routes/toolRules.js";
import { chatRoutes } from "./routes/chat.js";
import { describeProviders } from "./chat/providers.js";
import { inviteRoutes } from "./routes/invites.js";
import { userRoutes } from "./routes/users.js";
import { originCheck } from "./auth/csrf.js";
import { mcpEndpoint } from "./mcp/endpoint.js";
import { gatewayApiRoutes } from "./routes/gatewayApi.js";
import { auditRoutes } from "./routes/audit.js";
import { toolRoutes } from "./routes/tools.js";
import { startManager, stopManager } from "./mcp/manager.js";
import { serverRoutes } from "./routes/servers.js";
import { seedServers } from "./seed.js";
import cookie from "@fastify/cookie";
import { authRoutes } from "./routes/auth.js";
import { bootstrapAdmin } from "./auth/bootstrap.js";
import Fastify from "fastify";
import { config } from "./config.js";
import { pool, waitForDb } from "./db.js";
import { migrate } from "./migrate.js";

const app = Fastify({ logger: true });

app.addHook("onRequest", originCheck);

await app.register(inviteRoutes);
await app.register(userRoutes);
await app.register(cookie);
await app.register(authRoutes);
await app.register(serverRoutes);
await app.register(toolRoutes);
await app.register(gatewayApiRoutes);
await app.register(auditRoutes);
await app.register(mcpEndpoint);
await app.register(chatRoutes);
await app.register(toolRuleRoutes);

// Liveness: "is the process alive?" Never touches the DB, so a DB outage
// doesn't make Kubernetes restart the gateway pointlessly.
app.get("/healthz", async () => ({ status: "ok" }));

// Readiness: "can I serve traffic?" Needs the database.
app.get("/readyz", async (_req, reply) => {
  try {
    await pool.query("SELECT 1");
    return { status: "ready" };
  } catch {
    return reply.code(503).send({ status: "database unavailable" });
  }
});

async function main() {
  await waitForDb();
  await migrate((m) => app.log.info(m));
  await bootstrapAdmin((m) => app.log.info(m));
  await seedServers((m) => app.log.info(m));
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
  startManager((m) => app.log.info(m));
  const llm = describeProviders();
  if (llm.length === 0) app.log.warn("no LLM provider configured: chat is disabled (run scripts/set-llm-keys.sh)");
  else app.log.info(`LLM providers: ${llm.map((p) => `${p.name}/${p.model} (${p.role})`).join(", ")}`);
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    app.log.info(`${sig} received, shutting down`);
    stopManager();
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
