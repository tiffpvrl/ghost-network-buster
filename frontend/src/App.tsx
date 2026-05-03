import { NavLink, Route, Routes } from "react-router-dom";
import { LocaleProvider, useLocale } from "./locale";
import Dashboard from "./pages/Dashboard";
import Employer from "./pages/Employer";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import Results from "./pages/Results";
import Terms from "./pages/Terms";

function Shell() {
  const { locale, setLocale, t } = useLocale();
  const showEmployer = import.meta.env.VITE_SHOW_EMPLOYER !== "false";
  const otherLocale = locale === "en" ? "es" : "en";

  return (
    <div className="shell">
      <a href="#main-content" className="skip-link print-hidden">
        {t("skipToMain")}
      </a>
      <header className="top-nav print-hidden">
        <NavLink to="/" className="brand">
          {t("navBrand")}
        </NavLink>
        <nav className="nav-links">
          <NavLink end to="/" className={({ isActive }) => (isActive ? "active" : "")}>
            {t("navPatientAudit")}
          </NavLink>
          {showEmployer ? (
            <NavLink to="/employer" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navEmployer")}
            </NavLink>
          ) : null}
          <button
            type="button"
            className="locale-toggle print-hidden"
            onClick={() => setLocale(otherLocale)}
            aria-label={locale === "en" ? "Switch to Spanish" : "Switch to English"}
          >
            {locale === "en" ? t("langToggle") : t("langToggleEs")}
          </button>
        </nav>
      </header>
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/audit/:auditId" element={<Dashboard />} />
          <Route path="/results/:auditId" element={<Results />} />
          <Route path="/employer" element={<Employer />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <Shell />
    </LocaleProvider>
  );
}
