import { useState, type FormEvent } from "react";
import { CopyBox } from "../../shared/components/CopyBox/CopyBox";
import type { Role } from "../../shared/types";
import { createInvite, type CreatedInvite } from "./members.api";

export function InviteForm({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [fresh, setFresh] = useState<CreatedInvite | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try { setFresh(await createInvite(email, role)); setEmail(""); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create invite"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <form className="inline-form" onSubmit={submit}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required />
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create invite"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {fresh && (
        <div className="card fresh">
          <strong>Send this link to {fresh.email}. It is shown only once and expires in 48 hours.</strong>
          <CopyBox value={`${window.location.origin}${fresh.path}`} />
          <button className="secondary" onClick={() => setFresh(null)}>Done</button>
        </div>
      )}
    </div>
  );
}
