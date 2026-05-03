import { useCallback, useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import RequireAuth from "./auth/RequireAuth";
import RoleGate from "./auth/RoleGate";
import { LocaleProvider, useLocale } from "./locale";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Privacy from "./pages/Privacy";
import Results from "./pages/Results";
import Terms from "./pages/Terms";
import AppLayout from "./pages/app/AppLayout";
import EmployerHome from "./pages/app/EmployerHome";
import PatientHome from "./pages/app/PatientHome";
import Checkout from "./pages/auth/Checkout";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import Home from "./pages/marketing/Home";
import HowItWorks from "./pages/marketing/HowItWorks";
import Pricing from "./pages/marketing/Pricing";

const THEME_KEY = "gnb_theme";

function TopNav() {
  const { locale, setLocale, t } = useLocale();
  const { user } = useAuth();
  const otherLocale = locale === "en" ? "es" : "en";
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light",
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((th) => (th === "light" ? "dark" : "light"));
  }, []);

  return (
    <header className="top-nav print-hidden">
      <NavLink to="/" className="brand">
        {t("navBrand")}
      </NavLink>
      <nav className="nav-links">
        {user ? (
          <NavLink
            to={user.role === "employer" ? "/app/employer" : "/app/patient"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            {t("navAppHome")}
          </NavLink>
        ) : (
          <>
            <NavLink end to="/" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navHome")}
            </NavLink>
            <NavLink to="/how-it-works" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navHow")}
            </NavLink>
            <NavLink to="/pricing" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navPricing")}
            </NavLink>
            <NavLink to="/login" className={({ isActive }) => (isActive ? "active" : "")}>
              {t("navLogin")}
            </NavLink>
          </>
        )}
        <button
          type="button"
          className="theme-toggle print-hidden"
          onClick={toggleTheme}
          aria-label={theme === "light" ? t("themeAriaDark") : t("themeAriaLight")}
        >
          {theme === "light" ? t("themeUseDark") : t("themeUseLight")}
        </button>
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
  );
}

function Shell() {
  const { t } = useLocale();
  return (
    <div className="shell">
      <a href="#main-content" className="skip-link print-hidden">
        {t("skipToMain")}
      </a>
      <TopNav />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/app" element={<RoleGate />} />
              <Route path="/app/patient" element={<PatientHome />} />
              <Route path="/app/patient/audits/new" element={<Landing />} />
              <Route path="/app/patient/audits/:auditId" element={<Dashboard />} />
              <Route path="/app/patient/results/:auditId" element={<Results />} />
              <Route path="/app/employer" element={<EmployerHome />} />
            </Route>
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </LocaleProvider>
  );
}
