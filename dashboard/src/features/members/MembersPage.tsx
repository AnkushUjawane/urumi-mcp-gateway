import { useState } from "react";
import { useAuth } from "../../app/AuthContext";
import { usePolling } from "../../shared/hooks/usePolling";
import { deleteInvite, listInvites, listMembers, updateMember } from "./members.api";
import { InviteForm } from "./InviteForm";
import { MemberRow } from "./MemberRow";
import "./members.css";
import "../keys/keys.css";

export function MembersPage() {
  const { user } = useAuth();
  const members = usePolling(listMembers, 15_000);
  const invites = usePolling(listInvites, 15_000);
  const [actionError, setActionError] = useState("");

  async function run(fn: () => Promise<unknown>) {
    setActionError("");
    try { await fn(); await Promise.all([members.reload(), invites.reload()]); }
    catch (e) { setActionError(e instanceof Error ? e.message : "Action failed"); }
  }

  return (
    <div>
      <h2>Members</h2>
      <p className="muted">Invite teammates, disable accounts, and revoke their API keys. Disabling a user blocks their dashboard session and every key at once.</p>
      <InviteForm onCreated={invites.reload} />
      {actionError && <p className="error" role="alert">{actionError}</p>}
      {members.error && <p className="error" role="alert">{members.error}</p>}

      <table className="table">
        <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Active keys</th><th></th></tr></thead>
        <tbody>
          {members.data?.map((m) => (
            <MemberRow key={m.id} member={m} isSelf={m.id === user?.id}
              onChanged={members.reload}
              onToggleDisabled={() => run(() => updateMember(m.id, { disabled: !m.disabled_at }))}
              onToggleRole={() => run(() => updateMember(m.id, { role: m.role === "admin" ? "member" : "admin" }))} />
          ))}
        </tbody>
      </table>

      <h3>Pending invites</h3>
      {invites.data?.length === 0 && <p className="muted">No pending invites.</p>}
      <ul className="tools">
        {invites.data?.map((i) => (
          <li key={i.id}>
            {i.email} ({i.role}) <span className="muted">expires {new Date(i.expires_at).toLocaleString()}</span>{" "}
            <button className="danger" onClick={() => run(() => deleteInvite(i.id))}>Cancel</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
