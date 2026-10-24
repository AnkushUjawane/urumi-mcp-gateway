export type Role = "admin" | "member";
export type User = { id: string; email: string; role: Role };

export type ServerStatus = "connected" | "unreachable" | "disabled" | "unknown";
export type AuthType = "none" | "bearer" | "header";

// Members receive only the first group of fields; admins receive all of them.
export type Server = {
  id: string;
  slug: string;
  name: string;
  enabled: boolean;
  status: ServerStatus;
  status_reason: string | null;
  last_checked_at: string | null;
  url?: string;
  auth_type?: AuthType;
  header_name?: string | null;
  hasCredential?: boolean;
};

export type ToolSummary = { name: string; description: string };

export type Member = {
  id: string; email: string; role: Role;
  created_at: string; disabled_at: string | null; active_keys: number;
};
export type Invite = { id: string; email: string; role: Role; expires_at: string };
export type ApiKey = {
  id: string; name: string; prefix: string;
  created_at: string; last_used_at: string | null; revoked_at: string | null;
};
export type NewKey = ApiKey & { key: string };  // `key` exists only in the creation response

export type AuditStatus = "ok" | "error" | "timeout" | "denied";
export type AuditRow = {
  id: string;                    // bigserial arrives as a string
  ts: string;
  user_email: string | null;
  source: "mcp" | "chat" | "api";
  server_slug: string | null;
  tool: string;
  duration_ms: number;
  status: AuditStatus;
  error_message: string | null;
};
export type AuditResponse = { rows: AuditRow[]; next_before: string | null };
