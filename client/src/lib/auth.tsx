import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { queryClient } from "./queryClient";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string | null;
  createdAt: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(body.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const checkSession = useCallback(async () => {
    try {
      const data = await authFetch<{ user: AuthUser | null }>("/api/auth/session");
      if (data.user) {
        setState({ user: data.user, isLoading: false, isAuthenticated: true });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((prev) => ({ ...prev, isLoading: true }));
      try {
        await authFetch("/api/auth/sign-in/email", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        await checkSession();
        return { success: true };
      } catch (err) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return { success: false, error: (err as Error).message };
      }
    },
    [checkSession]
  );

  const signOut = useCallback(async () => {
    try {
      await authFetch("/api/auth/sign-out", { method: "POST" });
    } catch {
      // ignore
    }
    queryClient.clear();
    setState({ user: null, isLoading: false, isAuthenticated: false });
    window.location.href = "/auth";
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signOut, checkSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
