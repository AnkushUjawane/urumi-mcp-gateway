import pg from "pg";
import { config } from "./config.js";

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});

// Idle clients can emit errors (e.g. the DB restarts). Without this handler the process would crash.
pool.on("error", (e) => console.error("pg pool error:", e.message));

// Postgres may still be starting when the gateway starts, so retry instead of crashing.
export async function waitForDb(attempts = 30, delayMs = 2000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (e: any) {
      console.log(`waiting for database (${i}/${attempts}): ${e.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("database not reachable");
}
