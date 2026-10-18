import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { decrypt } from "../crypto.js";

export type ServerRow = {
  id: string; slug: string; name: string; url: string; enabled: boolean;
  auth_type: "none" | "bearer" | "header"; header_name: string | null; credential_enc: string | null;
};

// reason is a short, human-readable label shown in the dashboard and audit log.
export class UpstreamError extends Error {
  constructor(public reason: string, message: string) { super(message); }
}

export function classify(e: any): string {
  const msg = String(e?.message ?? e);
  const code = e?.cause?.code ?? (typeof e?.code === "string" ? e.code : undefined);
  if (typeof e?.code === "number" && (e.code === 401 || e.code === 403)) return `auth failed (${e.code})`;
  if (typeof e?.code === "number" && e.code >= 400 && e.code < 600 && e.code !== -32001) return `upstream HTTP ${e.code}`;
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || /timed out|timeout/i.test(msg)) return "timeout";
  if (code === "ECONNREFUSED") return "connection refused";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "DNS lookup failed";
  if (code === "ECONNRESET" || code === "UND_ERR_SOCKET") return "connection reset";
  return "protocol error";
}

function buildHeaders(row: ServerRow): Record<string, string> {
  const h: Record<string, string> = {};
  if (row.auth_type === "none" || !row.credential_enc) return h;
  let secret: string;
  try { secret = decrypt(row.credential_enc); }
  catch { throw new UpstreamError("credential error", "stored credential cannot be decrypted (wrong key or tampered data)"); }
  // The upstream gets ITS OWN credential. The caller's gateway key is never forwarded.
  if (row.auth_type === "bearer") h["Authorization"] = `Bearer ${secret}`;
  else if (row.header_name) h[row.header_name] = secret;
  return h;
}

// Runs fn with a connected client under one hard deadline covering connect AND the work.
// Upstreams are stateless, so a short-lived client per operation needs no reconnect logic.
export async function withClient<T>(
  row: ServerRow, timeoutMs: number, fn: (c: Client) => Promise<T>,
): Promise<T> {
  const headers = buildHeaders(row);
  const transport = new StreamableHTTPClientTransport(new URL(row.url), { requestInit: { headers } });
  const client = new Client({ name: "urumi-gateway", version: "0.1.0" });
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await Promise.race([
      (async () => { await client.connect(transport, { timeout: timeoutMs }); return fn(client); })(),
      new Promise<never>((_, reject) =>
        ac.signal.addEventListener("abort", () =>
          reject(new UpstreamError("timeout", `no response within ${timeoutMs}ms`)))),
    ]);
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError(classify(e), String((e as any)?.message ?? e));
  } finally {
    clearTimeout(timer);
    client.close().catch(() => {});
  }
}
