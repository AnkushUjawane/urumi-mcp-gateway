import { useState, type FormEvent } from "react";
import type { AuthType, Server } from "../../shared/types";
import { createServer, updateServer, type UpdateServer } from "./servers.api";

type Props = { server?: Server; onSaved: () => void; onCancel: () => void };

export function ServerForm({ server, onSaved, onCancel }: Props) {
  const editing = !!server;
  const [slug, setSlug] = useState(server?.slug ?? "");
  const [name, setName] = useState(server?.name ?? "");
  const [url, setUrl] = useState(server?.url ?? "");
  const [authType, setAuthType] = useState<AuthType>(server?.auth_type ?? "none");
  const [headerName, setHeaderName] = useState(server?.header_name ?? "");
  const [credential, setCredential] = useState("");   // write-only: never pre-filled
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (editing) {
        const body: UpdateServer = {
          name, url, auth_type: authType,
          header_name: authType === "header" ? headerName : null,
        };
        if (authType === "none") body.credential = null;          // switching to "none" clears it
        else if (credential) body.credential = credential;        // typed = replace; blank = keep
        await updateServer(server!.id, body);
      } else {
        await createServer({
          slug, name, url, auth_type: authType,
          header_name: authType === "header" ? headerName : undefined,
          credential: authType !== "none" && credential ? credential : undefined,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally { setBusy(false); }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label>Slug {editing && <span className="muted">(cannot be changed)</span>}
        <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} disabled={editing}
               pattern="[a-z0-9]([a-z0-9\-]{0,22}[a-z0-9])?" required
               placeholder="e.g. weather" title="1-24 chars: lowercase letters, digits, single hyphens" />
      </label>
      <label>Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label>URL (Streamable HTTP endpoint)
        <input value={url} onChange={(e) => setUrl(e.target.value)} required
               placeholder="http://my-server.my-ns.svc.cluster.local:3000/mcp" />
      </label>
      <label>Authentication
        <select value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
          <option value="none">None</option>
          <option value="bearer">Bearer token</option>
          <option value="header">Custom header</option>
        </select>
      </label>
      {authType === "header" && (
        <label>Header name
          <input value={headerName} onChange={(e) => setHeaderName(e.target.value)} required placeholder="X-Api-Key" />
        </label>
      )}
      {authType !== "none" && (
        <label>Credential
          <input type="password" value={credential} onChange={(e) => setCredential(e.target.value)}
                 autoComplete="new-password"
                 required={!editing || !server?.hasCredential}
                 placeholder={editing && server?.hasCredential ? "Stored. Leave blank to keep it." : ""} />
          <span className="muted small">Stored encrypted. It is never shown again, and users never see it.</span>
        </label>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add server"}</button>
        <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
