import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Role = "patient" | "employer";

export type AuthUser = {
  email: string;
  role: Role;
};

const USER_KEY = "gnb_user";
const CREDITS_KEY = "gnb_credits";

type AuthContextValue = {
  user: AuthUser | null;
  credits: number;
  login: (email: string, role?: Role) => AuthUser;
  signup: (email: string, role: Role) => AuthUser;
  logout: () => void;
  addCredits: (n: number) => void;
  consumeCredit: () => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (
      parsed &&
      typeof parsed.email === "string" &&
      (parsed.role === "patient" || parsed.role === "employer")
    ) {
      return { email: parsed.email, role: parsed.role };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readCredits(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(CREDITS_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  const [credits, setCredits] = useState<number>(readCredits);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(CREDITS_KEY, String(credits));
  }, [credits]);

  const login = useCallback((email: string, role: Role = "patient") => {
    const next: AuthUser = { email, role };
    setUser(next);
    return next;
  }, []);

  const signup = useCallback((email: string, role: Role) => {
    const next: AuthUser = { email, role };
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const addCredits = useCallback((n: number) => {
    setCredits((c) => Math.max(0, c + Math.floor(n)));
  }, []);

  const consumeCredit = useCallback(() => {
    let consumed = false;
    setCredits((c) => {
      if (c > 0) {
        consumed = true;
        return c - 1;
      }
      return c;
    });
    return consumed;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, credits, login, signup, logout, addCredits, consumeCredit }),
    [user, credits, login, signup, logout, addCredits, consumeCredit],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
