import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  plan: "starter" | "pro" | "lifetime";
  lifetimeAccess: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Login failed");
    }
    setUser(await res.json());
  }

  async function register(email: string, password: string) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Registration failed" }));
      throw new Error(err.error ?? "Registration failed");
    }
    setUser(await res.json());
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export async function startCheckout(plan: "pro" | "lifetime") {
  const res = await fetch("/api/stripe/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Checkout failed" }));
    throw new Error(err.error ?? "Checkout failed");
  }
  const { url } = await res.json();
  window.location.href = url;
}
