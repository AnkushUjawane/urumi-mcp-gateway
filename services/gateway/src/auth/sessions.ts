import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

// Cookie value: base64url(payload).signature. The HMAC stops anyone editing the payload.
// The user row is re-read on every request, so disabling a user takes effect immediately.
const TTL_MS = 8 * 60 * 60 * 1000;

const sign = (data: string) => createHmac("sha256", config.SESSION_SECRET).update(data).digest("base64url");

export function makeSession(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(value: string | undefined): string | null {
  if (!value) return null;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof uid === "string" && exp > Date.now() ? uid : null;
  } catch { return null; }
}

export const SESSION_COOKIE = "gw_session";
export const SESSION_MAX_AGE_S = TTL_MS / 1000;
