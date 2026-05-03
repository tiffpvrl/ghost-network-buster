import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, type Role } from "../../auth/AuthProvider";
import { useLocale } from "../../locale";

export default function Signup() {
  const { t } = useLocale();
  const { signup } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const initialRole: Role = params.get("role") === "employer" ? "employer" : "patient";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(initialRole);
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const trimmed = email.trim();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      setErr(t("authErrEmail"));
      return;
    }
    if (password.length < 6) {
      setErr(t("authErrPasswordMin"));
      return;
    }
    const u = signup(trimmed, role);
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
        <div className="auth-card__eyebrow">{t("authSignupEyebrow")}</div>
        <h1 className="auth-card__title">{t("authSignupTitle")}</h1>
        <p className="auth-card__sub">{t("authDemoNotice")}</p>
        <form onSubmit={submit}>
          <div style={{ marginBottom: "1rem" }}>
            <span className="auth-card__field-label">{t("authRoleQuestion")}</span>
            <div className="role-choice">
              <label className={`role-option${role === "patient" ? " on" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="patient"
                  checked={role === "patient"}
                  onChange={() => setRole("patient")}
                />
                <div>
                  <strong>{t("roleSelf")}</strong>
                  <span>{t("roleSelfBody")}</span>
                </div>
              </label>
              <label className={`role-option${role === "employer" ? " on" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="employer"
                  checked={role === "employer"}
                  onChange={() => setRole("employer")}
                />
                <div>
                  <strong>{t("roleEmployer")}</strong>
                  <span>{t("roleEmployerBody")}</span>
                </div>
              </label>
            </div>
          </div>
          <div style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="signup-email">{t("authEmail")}</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="signup-password">{t("authPassword")}</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}
          <button type="submit" className="btn full">
            {t("authSignupCta")}
          </button>
        </form>
        <p className="auth-card__alt">
          {t("authSignupHaveAccount")} <Link to="/login">{t("authLoginLink")}</Link>
        </p>
      </div>
    </div>
  );
}
