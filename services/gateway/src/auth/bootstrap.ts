import { pool } from "../db.js";
import { config } from "../config.js";
import { hashPassword } from "./passwords.js";

// Creates the first admin from the Secret if no users exist yet.
// ON CONFLICT makes it safe when several replicas start together.
export async function bootstrapAdmin(log: (m: string) => void) {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM users");
  if (rows[0].n > 0) return;
  await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1,$2,'admin') ON CONFLICT (email) DO NOTHING",
    [config.ADMIN_EMAIL, await hashPassword(config.ADMIN_PASSWORD)],
  );
  log(`created first admin ${config.ADMIN_EMAIL}`);
}
