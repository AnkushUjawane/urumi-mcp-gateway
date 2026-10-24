import { api } from "../../shared/api/client";
import type { ApiKey, Invite, Member, Role } from "../../shared/types";

export const listMembers = () => api<Member[]>("/api/users");
export const updateMember = (id: string, body: { disabled?: boolean; role?: Role }) =>
  api<Member>(`/api/users/${id}`, { method: "PATCH", body });
export const memberKeys = (id: string) => api<ApiKey[]>(`/api/users/${id}/keys`);
export const revokeMemberKey = (keyId: string) => api(`/api/keys/${keyId}`, { method: "DELETE" });

export const listInvites = () => api<Invite[]>("/api/invites");
export type CreatedInvite = Invite & { token: string; path: string };
export const createInvite = (email: string, role: Role) =>
  api<CreatedInvite>("/api/invites", { method: "POST", body: { email, role } });
export const deleteInvite = (id: string) => api(`/api/invites/${id}`, { method: "DELETE" });
