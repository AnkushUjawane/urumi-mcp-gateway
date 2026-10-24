import { useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { usePolling } from "../../shared/hooks/usePolling";
import { Modal } from "../../shared/components/Modal/Modal";
import type { Server } from "../../shared/types";
import { deleteServer, listServers, refreshServers, updateServer } from "./servers.api";
import { ServerForm } from "./ServerForm";
import { ServerRow } from "./ServerRow";
import "./servers.css";

export function ServersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, error, loading, reload } = usePolling(listServers, 10_000);
  const [editing, setEditing] = useState<Server | "new" | null>(null);
  const [actionError, setActionError] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setActionError("");
    try { await fn(); await reload(); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Action failed"); }
  }

  const remove = (s: Server) => {
    if (window.confirm(`Remove server "${s.name}"? Its tools disappear for everyone.`)) run(() => deleteServer(s.id));
  };

  return (
    <div>
      <div className="page-head">
        <h2>MCP servers</h2>
        {isAdmin && (
          <div className="actions">
            <button className="secondary" onClick={() => run(refreshServers)}>Refresh now</button>
            <button onClick={() => setEditing("new")}>Add server</button>
          </div>
        )}
      </div>
      <p className="muted">Status updates every 10 seconds. Tools from every connected server are available through one gateway endpoint.</p>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {data?.length === 0 && <p className="muted">No servers registered yet.</p>}

      <div className="server-list">
        {data?.map((s) => (
          <ServerRow key={s.id} server={s} isAdmin={isAdmin}
            onEdit={() => setEditing(s)}
            onToggle={() => run(() => updateServer(s.id, { enabled: !s.enabled }))}
            onRemove={() => remove(s)} />
        ))}
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Add MCP server" : `Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <ServerForm server={editing === "new" ? undefined : editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); reload(); }} />
        </Modal>
      )}
    </div>
  );
}
