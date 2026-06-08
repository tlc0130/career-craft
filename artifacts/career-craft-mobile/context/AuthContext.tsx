import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface User {
  id: string;
  email: string;
  plan: "starter" | "pro" | "lifetime";
  lifetimeAccess: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  apiBase: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = "@career_craft_user";
// SecureStore keys must be alphanumeric + ".", "-", "_" (no "@").
const COOKIE_KEY = "career_craft_cookie";

// The session cookie is a credential, so keep it in the OS keychain
// (expo-secure-store) on native. SecureStore isn't available on web, so fall
// back to AsyncStorage there.
async function setCookieValue(value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(COOKIE_KEY, value);
  } else {
    await SecureStore.setItemAsync(COOKIE_KEY, value);
  }
}

async function clearCookieValue(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(COOKIE_KEY);
  } else {
    await SecureStore.deleteItemAsync(COOKIE_KEY);
  }
}

export function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

export async function getStoredCookie(): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(COOKIE_KEY);
  }
  return SecureStore.getItemAsync(COOKIE_KEY);
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const base = getApiBase();
  const cookie = await getStoredCookie();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  return fetch(`${base}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

function extractCookie(response: Response): string | null {
  try {
    const raw = response.headers.get("set-cookie");
    if (!raw) return null;
    return raw.split(";")[0] ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data as User);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
      } else {
        setUser(null);
        await AsyncStorage.removeItem(USER_KEY);
        await clearCookieValue();
      }
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_KEY);
        if (stored) {
          setUser(JSON.parse(stored) as User);
        }
        await refreshUser();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Login failed");
    }
    const cookie = extractCookie(res);
    if (cookie) {
      await setCookieValue(cookie);
    }
    const data = (await res.json()) as User;
    setUser(data);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Registration failed");
    }
    const cookie = extractCookie(res);
    if (cookie) {
      await setCookieValue(cookie);
    }
    const data = (await res.json()) as User;
    setUser(data);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    await AsyncStorage.removeItem(USER_KEY);
    await clearCookieValue();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        apiBase: getApiBase(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
