import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../app/AuthContext";
import type { AuditRow } from "../../shared/types";
import { listServers } from "../servers/servers.api";
import { fetchAudit } from "./audit.api";
import { AuditFilters } from "./AuditFilters";
import { AuditTable } from "./AuditTable";
import "../keys/keys.css";   // shared table style
import "./audit.css";

const PAGE = 50;

export function AuditPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useState("");
  const [server, setServer] = useState("");
  const [servers, setServers] = useState<string[]>([]);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const extended = useRef(false);   // true once the user clicked "Load more"

  // Newest rows. Resets paging.
  const load = useCallback(async () => {
    try {
      const r = await fetchAudit({ status: status || undefined, server: server || undefined, limit: PAGE });
      setRows(r.rows); setNext(r.next_before); extended.current = false; setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [status, server]);

  // Reload whenever a filter changes.
  useEffect(() => { setLoading(true); load(); }, [load]);

  // Auto-refresh, paused after "Load more" so pages never develop a gap.
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => { if (!extended.current) load(); }, 10_000);
    return () => clearInterval(t);
  }, [auto, load]);

  // Server names for the dropdown (members get the reduced view, which still has slugs).
  useEffect(() => { listServers().then((l) => setServers(l.map((s) => s.slug))).catch(() => {}); }, []);

  async function more() {
    if (!next) return;
    try {
      const r = await fetchAudit({ status: status || undefined, server: server || undefined, before: next, limit: PAGE });
      setRows((prev) => [...prev, ...r.rows]); setNext(r.next_before); extended.current = true;
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load more"); }
  }

  return (
    <div>
      <h2>Audit log</h2>
      <p className="muted">
        {isAdmin ? "Every tool call made through the gateway, by every user." : "Your tool calls."}
        {" "}Only metadata is recorded, never arguments or results.
      </p>
      <AuditFilters status={status} server={server} servers={servers} auto={auto}
        onStatus={setStatus} onServer={setServer} onAuto={setAuto} onRefresh={load} />
      {error && <p className="error" role="alert">{error}</p>}
      {loading ? <p className="muted">Loading…</p> : <AuditTable rows={rows} showUser={isAdmin} />}
      {next && <button className="secondary" onClick={more}>Load more</button>}
    </div>
  );
}
