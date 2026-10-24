import { useState, type FormEvent } from "react";
import { CopyBox } from "../../shared/components/CopyBox/CopyBox";
import type { NewKey } from "../../shared/types";
import { createKey } from "./keys.api";

export function CreateKeyForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<NewKey | null>(null);   // lives in memory only
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const gatewayUrl = `${window.location.origin}/mcp`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try { setFresh(await createKey(name)); setName(""); onCreated(); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not create key"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <form className="inline-form" onSubmit={submit}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. my laptop" required maxLength={60} />
        <button type="submit" disabled={busy}>{busy ? "Creating…" : "Create key"}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}

      {fresh && (
        <div className="card fresh">
          <strong>Copy your key now. It will not be shown again.</strong>
          <CopyBox value={fresh.key} />
          <p className="muted small">Connect an MCP client with one URL and this key:</p>
          <CopyBox label="Claude Code" value={`claude mcp add --transport http urumi ${gatewayUrl} --header "Authorization: Bearer ${fresh.key}"`} />
          <CopyBox label="Gateway URL" value={gatewayUrl} />
          <button className="secondary" onClick={() => setFresh(null)}>I have copied it</button>
        </div>
      )}
    </div>
  );
}
