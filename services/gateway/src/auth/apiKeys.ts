import { createHash, randomBytes } from "node:crypto";
import { pool } from "../db.js";

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

// A 256-bit random key cannot be guessed, so a fast hash is enough here
// (slow hashes are for low-entropy secrets like passwords).
export async function createApiKey(userId: string, name: string) {
  const key = "gw_" + randomBytes(32).toString("base64url");
  const { rows } = await pool.query(
    `INSERT INTO api_keys (user_id, name, prefix, key_hash)
     VALUES ($1,$2,$3,$4) RETURNING id, name, prefix, created_at`,
    [userId, name, key.slice(0, 11), sha256(key)],
  );
  return { ...rows[0], key }; // the full key is returned ONCE, never stored
}

export type KeyLookup =
  | { ok: true; keyId: string; user: { id: string; email: string; role: "admin" | "member" } }
  | { ok: false; reason: "invalid" | "revoked" | "user_disabled"; user?: { id: string; email: string } };

export async function verifyApiKey(key: string): Promise<KeyLookup> {
  const { rows } = await pool.query(
    `SELECT k.id AS key_id, k.revoked_at, u.id AS user_id, u.email, u.role, u.disabled_at
       FROM api_keys k JOIN users u ON u.id = k.user_id
      WHERE k.key_hash = $1`,
    [sha256(key)],
  );
  const r = rows[0];
  if (!r) return { ok: false, reason: "invalid" };
  const user = { id: r.user_id, email: r.email, role: r.role };
  // We know who owns a revoked key, so the caller can log the attempt under that user.
  if (r.revoked_at) return { ok: false, reason: "revoked", user };
  if (r.disabled_at) return { ok: false, reason: "user_disabled", user };
  pool.query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [r.key_id]).catch(() => {});
  return { ok: true, keyId: r.key_id, user };
}

export async function listApiKeys(userId: string) {
  const { rows } = await pool.query(
    `SELECT id, name, prefix, created_at, last_used_at, revoked_at
       FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
}

// Members can revoke only their own keys; admins can revoke any (pass userId = null).
export async function revokeApiKey(keyId: string, userId: string | null): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE api_keys SET revoked_at = now()
      WHERE id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR user_id = $2::uuid)`,
    [keyId, userId],
  );
  return (rowCount ?? 0) > 0;
}
