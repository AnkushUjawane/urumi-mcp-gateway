import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "../shared/types";
import { ApiError } from "../shared/api/client";
import * as authApi from "../features/auth/auth.api";

type Auth = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, ask the server who we are. A 401 simply means "not logged in".
  useEffect(() => {
    authApi.fetchMe()
      .then(setUser)
      .catch((e) => { if (!(e instanceof ApiError) || e.status !== 401) console.error(e); })
      .finally(() => setLoading(false));
  }, []);

  const value: Auth = {
    user, loading,
    login: async (email, password) => setUser(await authApi.login(email, password)),
    logout: async () => { await authApi.logout().catch(() => {}); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
