type Props = {
  status: string; server: string; servers: string[]; auto: boolean;
  onStatus: (v: string) => void; onServer: (v: string) => void;
  onAuto: (v: boolean) => void; onRefresh: () => void;
};

export function AuditFilters(p: Props) {
  return (
    <div className="filters">
      <label>Outcome
        <select value={p.status} onChange={(e) => p.onStatus(e.target.value)}>
          <option value="">All</option>
          <option value="ok">ok</option>
          <option value="error">error</option>
          <option value="timeout">timeout</option>
          <option value="denied">denied</option>
        </select>
      </label>
      <label>Server
        <select value={p.server} onChange={(e) => p.onServer(e.target.value)}>
          <option value="">All</option>
          {p.servers.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={p.auto} onChange={(e) => p.onAuto(e.target.checked)} />
        Auto-refresh
      </label>
      <button className="secondary" onClick={p.onRefresh}>Refresh</button>
    </div>
  );
}
