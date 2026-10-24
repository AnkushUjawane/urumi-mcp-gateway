import { api } from "../../shared/api/client";
import type { AuthType, Server, ServerStatus, ToolSummary } from "../../shared/types";

export const listServers = () => api<Server[]>("/api/servers");

export type CreateServer = {
  slug: string; name: string; url: string; auth_type: AuthType;
  header_name?: string; credential?: string; enabled?: boolean;
};
export const createServer = (body: CreateServer) => api<Server>("/api/servers", { method: "POST", body });

// credential: omitted = keep the stored one, null = remove it, string = replace it
export type UpdateServer = {
  name?: string; url?: string; auth_type?: AuthType; header_name?: string | null;
  credential?: string | null; enabled?: boolean;
};
export const updateServer = (id: string, body: UpdateServer) =>
  api<Server>(`/api/servers/${id}`, { method: "PATCH", body });

export const deleteServer = (id: string) => api(`/api/servers/${id}`, { method: "DELETE" });

export const refreshServers = () => api("/api/servers/refresh", { method: "POST" });

export type ToolsResponse = { status: ServerStatus; reason?: string | null; tools: ToolSummary[] };
export const fetchTools = (id: string) => api<ToolsResponse>(`/api/servers/${id}/tools`);
