"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiGet, apiPost, ApiError } from "@/lib/api";
import { clearAccessToken, setAccessToken } from "@/lib/auth-token";
import type { User } from "@/types";

interface LoginResponse {
  access_token: string;
  must_change_password: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ must_change_password: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiGet<User>("/api/v1/auth/me");
      setUser(data);
    } catch {
      clearAccessToken();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await apiPost<LoginResponse>("/api/v1/auth/login", { email, password });
    setAccessToken(data.access_token);
    try {
      const me = await apiGet<User>("/api/v1/auth/me");
      setUser(me);
    } catch (err) {
      clearAccessToken();
      setUser(null);
      throw err instanceof ApiError ? err : new Error("Login failed");
    }
    return { must_change_password: data.must_change_password };
  };

  const logout = async () => {
    try {
      await apiPost("/api/v1/auth/logout");
    } finally {
      clearAccessToken();
      setUser(null);
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
