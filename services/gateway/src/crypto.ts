import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

// AES-256 needs exactly 32 bytes. ENCRYPTION_KEY is a long random string from a Secret,
// so hashing it down to 32 bytes is sufficient here.
const KEY = createHash("sha256").update(config.ENCRYPTION_KEY).digest();

// Stored format: v1:<iv>:<auth tag>:<ciphertext>, all base64.
// A fresh random 12-byte IV for every value: reusing an IV with GCM breaks its security.
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

// GCM is authenticated: if the stored value was tampered with, or the key is wrong,
// final() throws instead of returning garbage.
export function decrypt(stored: string): string {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("unsupported credential format");
  const d = createDecipheriv("aes-256-gcm", KEY, Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}
