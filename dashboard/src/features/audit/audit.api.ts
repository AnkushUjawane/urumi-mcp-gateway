import { api } from "../../shared/api/client";
import type { AuditResponse } from "../../shared/types";

export type AuditQuery = { status?: string; server?: string; before?: string; limit?: number };

export function fetchAudit(q: AuditQuery) {
  const p = new URLSearchParams();
  if (q.status) p.set("status", q.status);
  if (q.server) p.set("server", q.server);
  if (q.before) p.set("before", q.before);
  p.set("limit", String(q.limit ?? 50));
  return api<AuditResponse>(`/api/audit?${p.toString()}`);
}
