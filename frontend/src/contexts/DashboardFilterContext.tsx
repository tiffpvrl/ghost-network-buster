import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Shared filter context for the authenticated app shell.
 *
 * - `q`: free-text query used to filter providers/transcripts on dashboard /
 *   results pages. Synced between the AppLayout topbar input and the inline
 *   filter UI on the active page so there is a single source of truth.
 * - `visible`: whether the topbar search input should render. Set true by the
 *   active page (Dashboard / Results) on mount and false on unmount.
 */
type DashboardFilterValue = {
  q: string;
  setQ: (s: string) => void;
  visible: boolean;
  setVisible: (v: boolean) => void;
};

const Ctx = createContext<DashboardFilterValue | null>(null);

export function DashboardFilterProvider({ children }: { children: ReactNode }) {
  const [q, setQ] = useState("");
  const [visible, setVisible] = useState(false);

  const handleSetQ = useCallback((s: string) => setQ(s), []);
  const handleSetVisible = useCallback((v: boolean) => setVisible(v), []);

  const value = useMemo<DashboardFilterValue>(
    () => ({ q, setQ: handleSetQ, visible, setVisible: handleSetVisible }),
    [q, handleSetQ, visible, handleSetVisible],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboardFilter(): DashboardFilterValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Outside the provider (e.g. tests, marketing pages) — return inert noop.
    return { q: "", setQ: () => undefined, visible: false, setVisible: () => undefined };
  }
  return ctx;
}
