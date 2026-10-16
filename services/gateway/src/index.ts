import Fastify from "fastify";
import { config } from "./config.js";
import { pool, waitForDb } from "./db.js";
import { migrate } from "./migrate.js";

const app = Fastify({ logger: true });

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
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    app.log.info(`${sig} received, shutting down`);
    await app.close();
    await pool.end();
    process.exit(0);
  });
}

main().catch((e) => {
  console.error("fatal:", e.message);
  process.exit(1);
});
