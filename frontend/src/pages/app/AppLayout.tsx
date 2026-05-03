import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { DashboardFilterProvider, useDashboardFilter } from "../../contexts/DashboardFilterContext";
import { useLocale } from "../../locale";

function SideIcon({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      {d ? <path d={d} /> : children}
    </svg>
  );
}

export default function AppLayout() {
  const { t } = useLocale();
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const location = useLocation();

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const s = localStorage.getItem("gnb_theme");
      if (s === "dark" || s === "light") return s;
    } catch { /* ignore */ }
    return (document.documentElement.getAttribute("data-theme") ?? "light") as "light" | "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try { localStorage.setItem("gnb_theme", theme); } catch { /* ignore */ }
  }, [theme]);

  if (!user) return null;

  function doLogout() {
    logout();
    nav("/", { replace: true });
  }

  const initials = user.email.slice(0, 2).toUpperCase();
  const isPatient = user.role !== "employer";
  const homeLink = isPatient ? "/app/patient" : "/app/employer";

  const pathParts = location.pathname.split("/").filter(Boolean);
  const isAudit = pathParts.includes("audits") || pathParts.includes("results");
  const isBatch = pathParts.includes("batches");
  const auditId = pathParts[pathParts.indexOf("audits") + 1] ?? pathParts[pathParts.indexOf("results") + 1];
  const batchId = isBatch ? pathParts[pathParts.indexOf("batches") + 1] : undefined;
  const isResults = pathParts.includes("results");

  const breadcrumbs: { label: string; current?: boolean }[] = [
    { label: isPatient ? "Patient" : "Employer" },
    ...(isBatch ? [{ label: "Batches" }] : []),
    ...(isAudit ? [{ label: "Audits" }] : []),
    ...(isResults ? [{ label: "Results", current: true }] : []),
    ...(isAudit && !isResults && auditId && auditId !== "new"
      ? [{ label: auditId.slice(0, 8), current: true }]
      : []),
    ...(auditId === "new" ? [{ label: "New Audit", current: true }] : []),
    ...(batchId ? [{ label: batchId.slice(0, 8), current: true }] : []),
  ];

  return (
    <DashboardFilterProvider>
    <div className="app" id="main-content">
      {/* ── Sidebar ── */}
      <aside className="beacon-sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
                d="M4 11a8 8 0 0 1 16 0v8q0 3-2 0-2-3-4 0-2 3-4 0-2-3-4 0-2 3-4 0V11Zm4.6.5a1.3 1.6 0 1 0 2.6 0a1.3 1.6 0 1 0 -2.6 0Zm4.8 0a1.3 1.6 0 1 0 2.6 0a1.3 1.6 0 1 0 -2.6 0Z"
              />
            </svg>
          </div>
          <div className="brand-name">GNB<span className="dot">.</span></div>
        </div>

        <nav className="sidebar-nav-section">
          <div className="sidebar-section-label">Workspace</div>
          <NavLink to={homeLink} end className={({ isActive }) => `sidebar-nav-item${isActive ? " active" : ""}`}>
            <SideIcon><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></SideIcon>
            {t("appWorkspacePatient") || "Overview"}
          </NavLink>
          <NavLink
            to={isPatient ? "/app/patient/audits/new" : "/app/employer/audits/new"}
            className={() => `sidebar-nav-item${isAudit || isBatch ? " active" : ""}`}
          >
            <SideIcon><path d="M9 11l3 3 7-7"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></SideIcon>
            Audits
            {!isAudit && !isBatch && <span className="sidebar-badge">new</span>}
          </NavLink>
        </nav>

        <nav className="sidebar-nav-section">
          <div className="sidebar-section-label">Configure</div>
          <button
            type="button"
            className="sidebar-nav-item"
            onClick={() => setTheme(th => th === "light" ? "dark" : "light")}
            title={theme === "light" ? t("themeAriaDark") : t("themeAriaLight")}
          >
            <SideIcon><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></SideIcon>
            {theme === "light" ? t("themeUseDark") : t("themeUseLight")}
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-avatar">{initials}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="sidebar-footer-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
            <div className="sidebar-footer-role">{user.role === "employer" ? "Employer" : "Patient"}</div>
          </div>
          <button type="button" className="sidebar-footer-btn" onClick={doLogout} title={t("appLogout")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="beacon-main">
        <div className="beacon-topbar print-hidden">
          <div className="topbar-breadcrumbs">
            {breadcrumbs.map((b, i) => (
              <span key={i} style={{ display: "contents" }}>
                {i > 0 && <span className="sep">/</span>}
                <span className={b.current ? "current" : ""}>{b.label}</span>
              </span>
            ))}
          </div>
          <div className="topbar-actions-row">
            <TopbarSearch />
          </div>
        </div>
        <div className="beacon-page">
          <Outlet />
        </div>
      </div>
    </div>
    </DashboardFilterProvider>
  );
}

/** Topbar search input — only renders on dashboard / results routes that
 * register `visible` on the shared DashboardFilterContext. */
function TopbarSearch() {
  const { q, setQ, visible } = useDashboardFilter();
  if (!visible) return null;
  return (
    <div className="topbar-search-box">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
      <input
        placeholder="Search providers or NPI…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filter providers"
      />
    </div>
  );
}
