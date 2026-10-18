import { pool } from "../db.js";
import { config } from "../config.js";
import { withClient, UpstreamError, type ServerRow } from "./upstream.js";

export type ToolInfo = { name: string; description: string; inputSchema: any };
type Entry = { id: string; status: "connected" | "unreachable"; reason: string | null; tools: ToolInfo[]; checkedAt: Date };

// slug -> last known state. Listing tools only ever reads this map.
const cache = new Map<string, Entry>();
let running = false;
let timer: NodeJS.Timeout | undefined;

const MAX_DESC = 500; // upstream descriptions are untrusted text: cap their length

async function save(row: ServerRow, status: string, reason: string | null) {
  await pool.query(
    "UPDATE servers SET status=$2, status_reason=$3, last_checked_at=now() WHERE id=$1",
    [row.id, status, reason]).catch((e) => console.error("status save failed:", e.message));
}

export async function refreshOne(row: ServerRow, log: (m: string) => void = console.log) {
  try {
    const tools = await withClient(row, config.UPSTREAM_LIST_TIMEOUT_MS, async (c) => {
      const all: ToolInfo[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page++) {            // bounded: a hostile server can't loop us forever
        const r = await c.listTools(cursor ? { cursor } : undefined);
        for (const t of r.tools) all.push({
          name: t.name,
          description: (t.description ?? "").slice(0, MAX_DESC),
          inputSchema: t.inputSchema,
        });
        cursor = r.nextCursor;
        if (!cursor) break;
      }
      return all.slice(0, 200);
    });
    const was = cache.get(row.slug)?.status;
    cache.set(row.slug, { id: row.id, status: "connected", reason: null, tools, checkedAt: new Date() });
    await save(row, "connected", null);
    if (was !== "connected") log(`upstream ${row.slug}: connected (${tools.length} tools)`);
  } catch (e) {
    const reason = e instanceof UpstreamError ? e.reason : "unexpected error";
    const was = cache.get(row.slug)?.status;
    // An unreachable server contributes NO tools, so they disappear from the merged list.
    cache.set(row.slug, { id: row.id, status: "unreachable", reason, tools: [], checkedAt: new Date() });
    await save(row, "unreachable", reason);
    if (was !== "unreachable") log(`upstream ${row.slug}: UNREACHABLE (${reason})`);
  }
}

export async function refreshAll(log: (m: string) => void = console.log) {
  if (running) return;                                   // never overlap two refresh rounds
  running = true;
  try {
    const { rows } = await pool.query("SELECT * FROM servers");
    const enabled: ServerRow[] = rows.filter((r) => r.enabled);
    const live = new Set(enabled.map((r) => r.slug));
    for (const slug of [...cache.keys()]) if (!live.has(slug)) cache.delete(slug); // disabled or removed
    // allSettled: every server is checked independently, so one slow or dead server
    // cannot delay or fail the others.
    await Promise.allSettled(enabled.map((r) => refreshOne(r, log)));
  } finally { running = false; }
}

export function startManager(log: (m: string) => void) {
  refreshAll(log).catch((e) => log(`refresh failed: ${e.message}`));
  timer = setInterval(() => refreshAll(log).catch(() => {}), config.REFRESH_INTERVAL_MS);
}
export function stopManager() { if (timer) clearInterval(timer); }

export const getEntry = (slug: string) => cache.get(slug);
export const getAllEntries = () => [...cache.entries()].filter(([, e]) => e.status === "connected");

// Called when a live call fails, so the dashboard reacts before the next refresh round (used in 4.6).
export function markUnreachable(slug: string, reason: string) {
  const e = cache.get(slug);
  if (e) cache.set(slug, { ...e, status: "unreachable", reason, tools: [], checkedAt: new Date() });
}
