import { useEffect, useState } from "react";
import { fetchTools, type ToolsResponse } from "./servers.api";

export function ToolList({ serverId, slug }: { serverId: string; slug: string }) {
  const [data, setData] = useState<ToolsResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTools(serverId).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  }, [serverId]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading tools…</p>;
  if (data.tools.length === 0)
    return <p className="muted">No tools available{data.reason ? ` (${data.reason})` : ""}.</p>;

  // Names and descriptions come from the upstream server: untrusted text.
  // React escapes them, and we never render them as HTML.
  return (
    <ul className="tools">
      {data.tools.map((t) => (
        <li key={t.name}>
          <code>{slug}__{t.name}</code>
          <span className="muted"> {t.description}</span>
        </li>
      ))}
    </ul>
  );
}
