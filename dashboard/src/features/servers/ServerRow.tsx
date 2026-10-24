import { useState } from "react";
import type { Server } from "../../shared/types";
import { StatusBadge } from "../../shared/components/StatusBadge/StatusBadge";
import { ToolList } from "./ToolList";

type Props = {
  server: Server;
  isAdmin: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
};

export function ServerRow({ server: s, isAdmin, onEdit, onToggle, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card server">
      <div className="server-head">
        <div>
          <strong>{s.name}</strong> <code>{s.slug}</code>
          <div className="muted">
            {isAdmin && s.url}
            {isAdmin && s.hasCredential && " · credential stored"}
          </div>
        </div>
        <div className="server-status">
          <StatusBadge status={s.status} reason={s.status_reason} />
          {s.status_reason && s.status === "unreachable" && <div className="error small">{s.status_reason}</div>}
          {s.last_checked_at && <div className="muted small">checked {new Date(s.last_checked_at).toLocaleTimeString()}</div>}
        </div>
      </div>
      <div className="actions">
        <button className="secondary" onClick={() => setOpen(!open)}>{open ? "Hide tools" : "Show tools"}</button>
        {isAdmin && (
          <>
            <button className="secondary" onClick={onEdit}>Edit</button>
            <button className="secondary" onClick={onToggle}>{s.enabled ? "Disable" : "Enable"}</button>
            <button className="danger" onClick={onRemove}>Remove</button>
          </>
        )}
      </div>
      {open && <ToolList serverId={s.id} slug={s.slug} />}
    </div>
  );
}
