import { useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { CreateKeyForm } from "./CreateKeyForm";
import { listKeys, revokeKey } from "./keys.api";
import "./keys.css";

const when = (s: string | null) => (s ? new Date(s).toLocaleString() : "never");

export function KeysPage() {
  const { data, error, loading, reload } = usePolling(listKeys, 15_000);
  const [actionError, setActionError] = useState("");

  async function revoke(id: string, name: string) {
    if (!window.confirm(`Revoke "${name}"? Any client using it stops working immediately.`)) return;
    setActionError("");
    try { await revokeKey(id); await reload(); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Revoke failed"); }
  }

  return (
    <div>
      <h2>API keys</h2>
      <p className="muted">Your personal keys for MCP clients. Calls made with a key are logged under your name.</p>
      <CreateKeyForm onCreated={reload} />
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {data && (
        <table className="table">
          <thead><tr><th>Name</th><th>Key</th><th>Created</th><th>Last used</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {data.length === 0 && <tr><td colSpan={6} className="muted">No keys yet.</td></tr>}
            {data.map((k) => (
              <tr key={k.id} className={k.revoked_at ? "dim" : ""}>
                <td>{k.name}</td>
                <td><code>{k.prefix}…</code></td>
                <td>{when(k.created_at)}</td>
                <td>{when(k.last_used_at)}</td>
                <td>{k.revoked_at ? `Revoked ${when(k.revoked_at)}` : "Active"}</td>
                <td>{!k.revoked_at && <button className="danger" onClick={() => revoke(k.id, k.name)}>Revoke</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
