import { pool } from "./db.js";

// Registers woo-mcp on first start so it is "already registered as the first server".
// DO NOTHING means an admin's later edits (or deletion... see below) are never overwritten.
export async function seedServers(log: (m: string) => void) {
  const url = process.env.SEED_WOO_URL;
  if (!url) return;
  const r = await pool.query(
    `INSERT INTO servers (slug, name, url, auth_type) VALUES ('woo', 'WooCommerce Store', $1, 'none')
     ON CONFLICT (slug) DO NOTHING`, [url]);
  if (r.rowCount) log("seeded server 'woo'");
}
