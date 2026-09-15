import { create } from "zustand";
import { api } from "@/lib/api";
import type { Role, SafeUser } from "./types";

const SESSION_KEY = "almajd-session";

export type AuthStatus = "loading" | "authenticated" | "guest";

function cacheUser(user: SafeUser | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user }));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* storage unavailable */
  }
}

function readCachedUser(): SafeUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: SafeUser };
    return parsed?.user ?? null;
  } catch {
    return null;
  }
}

type AuthState = {
  status: AuthStatus;
  currentUser: SafeUser | null;
  hydrate: () => Promise<void>;
  /** Server-backed login; persists via the httpOnly session cookie. */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Server-backed logout; clears the session cookie server-side. */
  logout: () => Promise<void>;
  getRole: () => Role | null;
  isAuthenticated: () => boolean;
};

let hydrating: Promise<void> | null = null;

function setSession(user: SafeUser | null) {
  cacheUser(user);
}

export const useAuth = create<AuthState>()((set, get) => ({
  status: "loading",
  // sessionStorage is only a display cache; the httpOnly cookie + server
  // sessions table is the real source of truth validated by hydrate().
  currentUser: readCachedUser(),

  hydrate: async () => {
    if (hydrating) return hydrating;
    hydrating = (async () => {
      try {
        const res = await api.get<{ user: SafeUser | null }>("/api/auth/session");
        if (res.ok && res.data?.user) {
          setSession(res.data.user);
          set({ status: "authenticated", currentUser: res.data.user });
          return;
        }
      } catch {
        /* fall through to guest */
      }
      setSession(null);
      set({ status: "guest", currentUser: null });
    })();
    try {
      await hydrating;
    } finally {
      hydrating = null;
    }
  },

  login: async (email, password) => {
    const res = await api.post<{ user: SafeUser }>("/api/auth/login", { email, password });
    if (!res.ok || !res.data?.user) {
      return { success: false, error: res.error ?? "فشل تسجيل الدخول" };
    }
    setSession(res.data.user);
    set({ status: "authenticated", currentUser: res.data.user });
    return { success: true };
  },

  logout: async () => {
    try {
      await api.post("/api/auth/logout", {});
    } catch {
      /* ignore — we clear locally regardless */
    }
    setSession(null);
    set({ status: "guest", currentUser: null });
  },

  getRole: () => get().currentUser?.role ?? null,

  isAuthenticated: () => get().status === "authenticated",
}));