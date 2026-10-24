import { api } from "../../shared/api/client";
import type { User } from "../../shared/types";

export const fetchMe = () => api<User>("/api/me");
export const login = (email: string, password: string) =>
  api<User>("/api/auth/login", { method: "POST", body: { email, password } });
export const logout = () => api("/api/auth/logout", { method: "POST" });
