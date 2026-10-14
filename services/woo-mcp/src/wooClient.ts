// REST client for WooCommerce. No MCP code here.

export class WooError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "WooError";
  }
}

// Config comes from env vars (filled from a Kubernetes Secret). Nothing is hardcoded.
function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const cfg = {
  baseUrl: () => env("WOO_BASE_URL").replace(/\/$/, ""), // in-cluster: http://wordpress
  publicHost: () => env("WOO_PUBLIC_HOST"),              // shop.localtest.me
  key: () => env("WOO_CONSUMER_KEY"),
  secret: () => env("WOO_CONSUMER_SECRET"),
  timeoutMs: () => Number(process.env.WOO_TIMEOUT_MS ?? 10000),
};

export async function woo<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  opts: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`${cfg.baseUrl()}/wp-json/wc/v3${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const auth = Buffer.from(`${cfg.key()}:${cfg.secret()}`).toString("base64");
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${auth}`,
        Host: cfg.publicHost(),            // WordPress redirects if Host is not its site URL
        "X-Forwarded-Proto": "https",      // WooCommerce accepts REST keys only over "HTTPS"
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      redirect: "manual",                  // a redirect means misconfiguration; never follow silently
      signal: AbortSignal.timeout(cfg.timeoutMs()),
    });
  } catch (e: any) {
    if (e?.name === "TimeoutError") {
      throw new WooError(`Store did not respond within ${cfg.timeoutMs()}ms`);
    }
    throw new WooError(`Cannot reach the store: ${e?.cause?.code ?? e?.message ?? e}`);
  }

  if (res.status >= 300 && res.status < 400) {
    throw new WooError(`Store redirected to ${res.headers.get("location")} (Host/URL misconfiguration)`, res.status);
  }

  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }

  if (!res.ok) {
    const msg = data?.message ?? text.slice(0, 200) ?? res.statusText;
    throw new WooError(`WooCommerce error ${res.status}: ${msg}`, res.status);
  }
  return data as T;
}
