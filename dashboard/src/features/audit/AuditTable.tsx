import type { AuditRow } from "../../shared/types";

const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`);
const short = (s: string, n = 70) => (s.length > n ? s.slice(0, n) + "…" : s);

export function AuditTable({ rows, showUser }: { rows: AuditRow[]; showUser: boolean }) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>When</th>{showUser && <th>User</th>}<th>Source</th><th>Server</th>
          <th>Tool</th><th>Duration</th><th>Outcome</th><th>Detail</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && <tr><td colSpan={showUser ? 8 : 7} className="muted">No calls match.</td></tr>}
        {rows.map((r) => (
          <tr key={r.id}>
            <td title={r.ts}>{new Date(r.ts).toLocaleString()}</td>
            {showUser && <td>{r.user_email ?? <span className="muted">deleted user</span>}</td>}
            <td>{r.source}</td>
            <td>{r.server_slug ? <code>{r.server_slug}</code> : <span className="muted">-</span>}</td>
            <td><code>{r.tool}</code></td>
            <td>{ms(r.duration_ms)}</td>
            <td><span className={`outcome outcome-${r.status}`}>{r.status}</span></td>
            {/* error_message may contain text written by an upstream server: rendered as plain text only */}
            <td className="detail" title={r.error_message ?? undefined}>{r.error_message ? short(r.error_message) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
