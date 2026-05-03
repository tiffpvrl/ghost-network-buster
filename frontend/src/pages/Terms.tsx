import { Link } from "react-router-dom";
import { useLocale } from "../locale";

export default function Terms() {
  const { t } = useLocale();
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="legal-page">
      <p className="banner legal-draft-banner" style={{ marginBottom: "1.25rem" }}>
        {t("legalDraftBanner")}
      </p>
      <h1>Terms of use (draft)</h1>
      <p className="lede">
        These terms are a non-binding placeholder for classroom and pilot deployments. Replace with
        counsel-reviewed terms before production.
      </p>
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>Automated verification calls</h2>
        <p className="lede">
          The service may place outbound calls to phone numbers listed in insurer directories to verify
          whether listings appear usable. You confirm you are authorized to request this verification on
          behalf of yourself or your dependent, as applicable.
        </p>
        <h2>Not medical or legal advice</h2>
        <p className="lede">Results do not diagnose, treat, or substitute for a licensed professional.</p>
        <h2>Recording</h2>
        <p className="lede">
          If calls are recorded or transcribed in your deployment, disclose and retain recordings
          according to applicable law (including state wiretap rules) and your privacy policy.
        </p>
        <h2>No warranty</h2>
        <p className="lede">The service is provided as-is. Directory accuracy can change hourly.</p>
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/">← Home</Link>
      </p>
    </div>
  );
}
