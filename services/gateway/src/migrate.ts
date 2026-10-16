import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./db.js";

// ../migrations works from both src/ (dev) and dist/ (built image)
const dir = process.env.MIGRATIONS_DIR ?? fileURLToPath(new URL("../migrations", import.meta.url));
const LOCK_ID = 727001; // arbitrary constant shared by all gateway replicas

export async function migrate(log: (m: string) => void = console.log): Promise<void> {
  const client = await pool.connect();
  try {
    // Session-level advisory lock: a second replica waits here until the first finishes.
    await client.query("SELECT pg_advisory_lock($1)", [LOCK_ID]);
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    const done = new Set((await client.query("SELECT name FROM schema_migrations")).rows.map((r) => r.name));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

    for (const f of files) {
      if (done.has(f)) continue;
      log(`applying migration ${f}`);
      const sql = await readFile(path.join(dir, f), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [f]);
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${f} failed: ${(e as Error).message}`);
      }
    }
    log(`migrations up to date (${files.length} files)`);
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}
