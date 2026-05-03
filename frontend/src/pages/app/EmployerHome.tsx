import Employer from "../Employer";
import { useLocale } from "../../locale";

/**
 * Thin wrapper around the existing Employer page that adds a workspace banner
 * so post-login employer users have an explicit "this is your workspace" cue.
 */
export default function EmployerHome() {
  const { t } = useLocale();
  return (
    <div className="employer-home">
      <div className="banner" style={{ marginBottom: "1rem" }} role="status">
        <strong>{t("employerWorkspaceTitle")}</strong> — {t("employerWorkspaceBody")}
      </div>
      <Employer />
    </div>
  );
}
