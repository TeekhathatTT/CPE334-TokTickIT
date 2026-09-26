import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, getCurrentUser, login as apiLogin, logout as apiLogout, type CurrentUser } from "../api";

export interface AuthState {
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<CurrentUser | null>;
}

const AuthContext = createContext<AuthState | null>(null);

/**
 * Session authentication state. The session itself lives in the HttpOnly
 * `toktickit_session` cookie (never in JS state); this context only mirrors
 * the safe identity returned by GET /api/auth/me.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { user: current } = await getCurrentUser();
      setUser(current);
      setError(null);
      return current;
    } catch (refreshError) {
      // 401 simply means "no session yet" — not an error state to display.
      if (refreshError instanceof ApiError && refreshError.status === 401) {
        setUser(null);
        setError(null);
        return null;
      }
      setError(refreshError instanceof Error ? refreshError.message : "Unable to load session.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const { user: current } = await apiLogin(email, password);
    setUser(current);
    setError(null);
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, logout, refresh }),
    [user, loading, error, login, logout, refresh],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return state;
}
