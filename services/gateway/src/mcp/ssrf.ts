// Validates an admin-supplied upstream URL. Upstreams legitimately live INSIDE the cluster,
// so we cannot simply block private addresses. Phase 7 replaces this with a stricter
// allow-list plus DNS resolution checks.
const DEV_LOOPBACK = process.env.DEV_ALLOW_LOOPBACK === "true"; // local development only
const LOOPBACK = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);
const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal"]);

export function validateUpstreamUrl(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "not a valid URL"; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return "only http and https URLs are allowed";
  if (u.username || u.password) return "credentials in the URL are not allowed; use the credential field";
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.startsWith("169.254.")) return `host ${host} is not allowed`;
  if (LOOPBACK.has(host) && !DEV_LOOPBACK) return `host ${host} is not allowed`;
  return null;
}
