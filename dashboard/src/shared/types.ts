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
