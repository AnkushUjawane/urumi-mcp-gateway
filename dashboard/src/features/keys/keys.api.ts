import { api } from "../../shared/api/client";
import type { ApiKey, NewKey } from "../../shared/types";

export const listKeys = () => api<ApiKey[]>("/api/keys");
export const createKey = (name: string) => api<NewKey>("/api/keys", { method: "POST", body: { name } });
export const revokeKey = (id: string) => api(`/api/keys/${id}`, { method: "DELETE" });
