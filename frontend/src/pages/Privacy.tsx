import { Link } from "react-router-dom";
import { useLocale } from "../locale";

export default function Privacy() {
  const { t } = useLocale();
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="legal-page">
      <p className="banner legal-draft-banner" style={{ marginBottom: "1.25rem" }}>
        {t("legalDraftBanner")}
      </p>
      <h1>Privacy summary (draft)</h1>
      <p className="lede">
        This page is a placeholder for educational deployments. Production systems need a complete privacy
        policy and data retention schedule.
      </p>
      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>What we process</h2>
        <p className="lede">
          Audits may process carrier name, ZIP, optional plan descriptors, call transcripts, and derived
          labels (e.g. “ghost” vs “real”). Do not enter card numbers or SSNs into this tool.
        </p>
        <h2>Retention</h2>
        <p className="lede">
          Configure retention on the server (local disk, GCS, or in-memory only). Share results links
          only with people you trust; anyone with a link may view the same content you see.
        </p>
        <h2>Share links</h2>
        <p className="lede">
          Operators may enable automatic expiry of old audits via server settings. Treat URLs as sensitive
          if transcripts are included.
        </p>
      </div>
      <p style={{ marginTop: "1.5rem" }}>
        <Link to="/">← Home</Link>
      </p>
    </div>
  );
}
