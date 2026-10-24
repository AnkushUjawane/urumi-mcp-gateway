import { useCallback, useState } from "react";
import { usePolling } from "../../shared/hooks/usePolling";
import { memberKeys, revokeMemberKey } from "./members.api";

export function MemberKeys({ userId, onChanged }: { userId: string; onChanged: () => void }) {
  const load = useCallback(() => memberKeys(userId), [userId]);
  const { data, error, reload } = usePolling(load, 20_000);
  const [actionError, setActionError] = useState("");

  async function revoke(id: string) {
    if (!window.confirm("Revoke this key? The next call using it is rejected.")) return;
    setActionError("");
    try { await revokeMemberKey(id); await reload(); onChanged(); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Revoke failed"); }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading keys…</p>;
  const active = data.filter((k) => !k.revoked_at);
  return (
    <div>
      {actionError && <p className="error">{actionError}</p>}
      {active.length === 0 && <p className="muted">No active keys.</p>}
      <ul className="tools">
        {active.map((k) => (
          <li key={k.id}>
            <code>{k.prefix}…</code> {k.name}
            <span className="muted"> · last used {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "never"} </span>
            <button className="danger" onClick={() => revoke(k.id)}>Revoke</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
