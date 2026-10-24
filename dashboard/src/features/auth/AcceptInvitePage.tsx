import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { acceptInvite, inviteInfo, type InviteInfo } from "./auth.api";

export function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "invalid">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    inviteInfo(token).then((i) => { setInfo(i); setState("ok"); }).catch(() => setState("invalid"));
  }, [token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setError(""); setBusy(true);
    try {
      await acceptInvite(token, password);
      // The server set the session cookie. A full reload makes the auth context re-read /api/me.
      window.location.assign("/servers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept the invite");
      setBusy(false);
    }
  }

  if (state === "loading") return <p className="center muted">Checking invite…</p>;
  if (state === "invalid")
    return <div className="card narrow"><h2>Invite not valid</h2><p>This invite link is invalid, already used, or has expired. Ask an admin for a new one.</p></div>;

  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>Join the gateway</h2>
      <p className="muted">Creating an account for <strong>{info?.email}</strong> ({info?.role}).</p>
      <label>Password (min 8 characters)
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus autoComplete="new-password" />
      </label>
      <label>Confirm password
        <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  );
}
