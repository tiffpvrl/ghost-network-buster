import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useLocale } from "../../locale";

/**
 * Inner shell used for authenticated /app routes. Renders an account menu and
 * a credits badge alongside the existing top-nav controls (theme, locale).
 */
export default function AppLayout() {
  const { t } = useLocale();
  const { user, credits, logout } = useAuth();
  const nav = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  function doLogout() {
    setMenuOpen(false);
    logout();
    nav("/", { replace: true });
  }

  return (
    <div className="app-shell">
      <div className="app-subnav print-hidden">
        <div className="app-subnav__left">
          <Link
            to={user.role === "employer" ? "/app/employer" : "/app/patient"}
            className="app-subnav__home"
          >
            {user.role === "employer" ? t("appWorkspaceEmployer") : t("appWorkspacePatient")}
          </Link>
          <span className="credits-badge" aria-label={t("creditsLabel")}>
            <strong className="mono-id">{credits}</strong> {t("creditsLabel")}
          </span>
        </div>
        <div className="app-subnav__right">
          <button
            type="button"
            className="account-menu__trigger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            {user.email}
          </button>
          {menuOpen ? (
            <div role="menu" className="account-menu__panel">
              <div className="account-menu__email">{user.email}</div>
              <Link role="menuitem" to="/checkout" className="account-menu__item" onClick={() => setMenuOpen(false)}>
                {t("appBuyCredits")}
              </Link>
              <button role="menuitem" type="button" className="account-menu__item" onClick={doLogout}>
                {t("appLogout")}
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <Outlet />
    </div>
  );
}
