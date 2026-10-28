import { isAllowed, type Role } from "./permissions.js";
import { pool } from "../db.js";
import { config } from "../config.js";
import { withClient, UpstreamError } from "./upstream.js";
import { getEntry, markUnreachable } from "./manager.js";
import { splitToolName } from "./aggregator.js";

export type Caller = { id: string; email: string; role: Role };
export type Source = "mcp" | "chat" | "api";
export type Outcome = "ok" | "error" | "timeout" | "denied";
export type ToolResult = { content: any[]; isError?: boolean };

const CONNECTION_REASONS = new Set(["timeout", "connection refused", "DNS lookup failed", "connection reset", "auth failed (401)", "auth failed (403)"]);
const MAX_ARGS_BYTES = 100_000;
const MAX_TEXT = 20_000;

const errResult = (msg: string): ToolResult => ({ isError: true, content: [{ type: "text", text: msg }] });

// Metadata only. We deliberately do NOT store arguments or results: they can hold private data.
export async function recordAudit(a: {
  user: { id: string; email: string }; source: Source; server: string | null; tool: string;
  ms: number; status: Outcome; message: string | null;
}) {
  try {
    await pool.query(
      `INSERT INTO audit_log (user_id, user_email, source, server_slug, tool, duration_ms, status, error_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [a.user.id, a.user.email, a.source, a.server, a.tool.slice(0, 200), a.ms, a.status, a.message?.slice(0, 300) ?? null]);
  } catch (e: any) {
    console.error("audit write failed:", e.message);   // never let logging break the call itself
  }
}

export async function callToolAs(user: Caller, source: Source, fullName: string, args: unknown): Promise<ToolResult> {
  const started = Date.now();
  let status: Outcome = "error";
  let message: string | null = null;
  let slug: string | null = null;
  let tool = fullName;

  const fail = (st: Outcome, msg: string): ToolResult => { status = st; message = msg; return errResult(msg); };

  try {
    const parts = splitToolName(fullName);
    if (!parts) return fail("error", `Unknown tool '${fullName}'. Tool names look like 'server__tool'.`);
    slug = parts.slug; tool = parts.tool;
    if (!(await isAllowed(user.role, fullName)))
      return fail("denied", `Tool '${fullName}' is not permitted for your role.`);

    const row = (await pool.query("SELECT * FROM servers WHERE slug = $1", [slug])).rows[0];
    if (!row) return fail("error", `Unknown tool '${fullName}'.`);
    if (!row.enabled) return fail("denied", `Server '${slug}' is disabled.`);

    const entry = getEntry(slug);
    if (!entry) return fail("error", `Server '${slug}' has not been checked yet. Retry in a few seconds.`);
    if (entry.status === "unreachable") return fail("error", `Server '${slug}' is unreachable (${entry.reason}).`);
    // Only tools the server actually advertised can be called.
    if (!entry.tools.some((t) => t.name === tool)) return fail("error", `Unknown tool '${fullName}'.`);

    const a = args ?? {};
    if (typeof a !== "object" || Array.isArray(a)) return fail("error", "Tool arguments must be a JSON object.");
    if (JSON.stringify(a).length > MAX_ARGS_BYTES) return fail("error", "Tool arguments too large.");

    const ms = config.UPSTREAM_CALL_TIMEOUT_MS;
    // The upstream receives ITS OWN credential (added inside withClient). The caller's key never leaves the gateway.
    const result: any = await withClient(row, ms, (c) =>
      c.callTool({ name: tool, arguments: a as Record<string, unknown> }, undefined, { timeout: ms }));

    const content = (result.content ?? []).map((c: any) =>
      c.type === "text" && c.text.length > MAX_TEXT ? { ...c, text: c.text.slice(0, MAX_TEXT) + "\n…[truncated]" } : c);
    if (result.isError) {
      status = "error";
      message = content.find((c: any) => c.type === "text")?.text ?? "tool reported an error";
    } else status = "ok";
    return { content, isError: !!result.isError };
  } catch (e) {
    const reason = e instanceof UpstreamError ? e.reason : "unexpected error";
    const detail = e instanceof Error ? e.message : String(e);
    if (slug && CONNECTION_REASONS.has(reason)) markUnreachable(slug, reason);   // tools vanish from listings immediately
    const hint = reason === "timeout" ? " The operation may still have completed on the server." : "";
    return fail(reason === "timeout" ? "timeout" : "error", `Call to '${slug ?? fullName}' failed: ${reason}.${hint}`
      + (reason === "protocol error" || reason === "unexpected error" ? ` (${detail.slice(0, 150)})` : ""));
  } finally {
    // Runs on EVERY path: success, tool error, timeout, rejection.
    await recordAudit({ user, source, server: slug, tool, ms: Date.now() - started, status, message });
  }
}
