import { api } from "../../shared/api/client";
import type { User } from "../../shared/types";

export const fetchMe = () => api<User>("/api/me");
export const login = (email: string, password: string) =>
  api<User>("/api/auth/login", { method: "POST", body: { email, password } });
export const logout = () => api("/api/auth/logout", { method: "POST" });

export type InviteInfo = { email: string; role: string };
export const inviteInfo = (token: string) =>
  api<InviteInfo>(`/api/auth/invite-info?token=${encodeURIComponent(token)}`);
export const acceptInvite = (token: string, password: string) =>
  api<User>("/api/auth/accept-invite", { method: "POST", body: { token, password } });
