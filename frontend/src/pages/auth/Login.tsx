import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useLocale } from "../../locale";

export default function Login() {
  const { t } = useLocale();
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = email.trim();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      setErr(t("authErrEmail"));
      return;
    }
    if (!password) {
      setErr(t("authErrPassword"));
      return;
    }
    const u = login(trimmed, "patient");
    const next = params.get("next");
    if (next) {
      try {
        nav(decodeURIComponent(next), { replace: true });
        return;
      } catch {
        /* fall through */
      }
    }
    nav(u.role === "employer" ? "/app/employer" : "/app/patient", { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="mktg-auth-brand">
        <div className="brand-mark">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2C5.24 2 3 4.24 3 7v5l2 2 1-1 1 1 1-1 1 1 1-1 2-2V7c0-2.76-2.24-5-5-5Z" />
            <circle cx="6" cy="8" r="0.8" fill="currentColor" stroke="none" />
            <circle cx="10" cy="8" r="0.8" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <span className="mktg-auth-brand__name">Ghost Network Buster</span>
      </div>
      <div className="auth-card">
        <div className="auth-card__eyebrow">{t("authLoginEyebrow")}</div>
        <h1 className="auth-card__title">{t("authLoginTitle")}</h1>
        <p className="auth-card__sub">{t("authDemoNotice")}</p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="login-email">{t("authEmail")}</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="login-password">{t("authPassword")}</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}
          <button type="submit" className="btn full">
            {t("authLoginCta")}
          </button>
        </form>
        <p className="auth-card__alt">
          {t("authLoginNoAccount")} <Link to="/signup">{t("authSignupLink")}</Link>
        </p>
      </div>
    </div>
  );
}
