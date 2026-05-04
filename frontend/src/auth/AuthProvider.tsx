import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { DEMO_AUDIT_ID } from "../demo-data";

export type Role = "patient" | "employer";

export type AuthUser = {
  email: string;
  role: Role;
};

export type EmployerTier = "starter" | "growth" | "enterprise";

type UnlockState = { shortlist: boolean; complaint: boolean };

const USER_KEY = "gnb_user";
const UNLOCKS_KEY = "gnb_audit_unlocks";
const EMPLOYER_TIER_KEY = "gnb_employer_tier";

type AuthContextValue = {
  user: AuthUser | null;
  login: (email: string, role?: Role) => AuthUser;
  signup: (email: string, role: Role) => AuthUser;
  logout: () => void;

  // Per-audit unlocks
  isShortlistUnlocked: (auditId: string) => boolean;
  isComplaintUnlocked: (auditId: string) => boolean;
  unlockShortlist: (auditId: string) => void;
  unlockComplaint: (auditId: string) => void;
  unlockBundle: (auditId: string) => void;

  // Employer subscription tier (mock)
  employerTier: EmployerTier | null;
  setEmployerTier: (t: EmployerTier | null) => void;
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

function readUnlocks(): Record<string, UnlockState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(UNLOCKS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, UnlockState> | null;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function readTier(): EmployerTier | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(EMPLOYER_TIER_KEY);
    if (v === "starter" || v === "growth" || v === "enterprise") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readUser);
  const [unlocks, setUnlocks] = useState<Record<string, UnlockState>>(readUnlocks);
  const [employerTier, setEmployerTierState] = useState<EmployerTier | null>(readTier);

  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(UNLOCKS_KEY, JSON.stringify(unlocks));
  }, [unlocks]);

  useEffect(() => {
    if (employerTier) localStorage.setItem(EMPLOYER_TIER_KEY, employerTier);
    else localStorage.removeItem(EMPLOYER_TIER_KEY);
  }, [employerTier]);

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

  const isShortlistUnlocked = useCallback(
    (auditId: string) => {
      if (auditId === DEMO_AUDIT_ID) return true;
      return unlocks[auditId]?.shortlist === true;
    },
    [unlocks],
  );

  const isComplaintUnlocked = useCallback(
    (auditId: string) => {
      if (auditId === DEMO_AUDIT_ID) return true;
      return unlocks[auditId]?.complaint === true;
    },
    [unlocks],
  );

  const unlockShortlist = useCallback((auditId: string) => {
    setUnlocks((prev) => {
      const cur = prev[auditId] ?? { shortlist: false, complaint: false };
      return { ...prev, [auditId]: { ...cur, shortlist: true } };
    });
  }, []);

  const unlockComplaint = useCallback((auditId: string) => {
    setUnlocks((prev) => {
      const cur = prev[auditId] ?? { shortlist: false, complaint: false };
      return { ...prev, [auditId]: { ...cur, complaint: true } };
    });
  }, []);

  const unlockBundle = useCallback((auditId: string) => {
    setUnlocks((prev) => ({
      ...prev,
      [auditId]: { shortlist: true, complaint: true },
    }));
  }, []);

  const setEmployerTier = useCallback((t: EmployerTier | null) => {
    setEmployerTierState(t);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login,
      signup,
      logout,
      isShortlistUnlocked,
      isComplaintUnlocked,
      unlockShortlist,
      unlockComplaint,
      unlockBundle,
      employerTier,
      setEmployerTier,
    }),
    [
      user,
      login,
      signup,
      logout,
      isShortlistUnlocked,
      isComplaintUnlocked,
      unlockShortlist,
      unlockComplaint,
      unlockBundle,
      employerTier,
      setEmployerTier,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
