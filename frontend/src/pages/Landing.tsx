import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiPost } from "../api";
import { DEMO_AUDIT_ID } from "../demo-data";

const CARE_OPTIONS = [
  "Anxiety", "Depression", "Trauma / PTSD", "ADHD",
  "Addiction", "Grief", "LGBTQ+ Affirming", "Spanish-speaking",
  "Sliding Scale", "Virtual Only", "In-Person",
];

const CARRIERS = ["Aetna", "BCBS", "Cigna", "UHC", "Optum", "Oscar", "Other"];

export default function Landing() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const [carrier, setCarrier] = useState("Aetna");
  const [zip, setZip] = useState("10001");
  const [needs, setNeeds] = useState<string[]>(["Anxiety", "Trauma / PTSD"]);
  const [busy, setBusy] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Auto-navigate when ?demo=true is in the URL
  useEffect(() => {
    if (searchParams.get("demo") === "true") {
      nav(`/audit/${DEMO_AUDIT_ID}`);
    }
  }, [searchParams, nav]);

  const providerCount = useMemo(() => 247, []);

  const toggle = (n: string) =>
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));

  async function start() {
    setErr(null);
    setBusy(true);
    setInitiating(true);
    try {
      const { audit_id } = await apiPost<{ audit_id: string }>("/api/start-audit", {
        carrier,
        zip_code: zip,
        care_needs: needs,
      });
      await new Promise((r) => setTimeout(r, 500));
      nav(`/audit/${audit_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start audit");
      setBusy(false);
      setInitiating(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: "0 auto", paddingTop: "2rem" }}>
      <div style={{ marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.6rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--muted)" }}>
          Columbia University · Agentic AI · May 2026
        </span>
      </div>

      <h1 style={{ marginBottom: "0.5rem" }}>GHOST NETWORK<br />BUSTER</h1>
      <p className="lede">Your insurer listed {providerCount} therapists. We'll find out how many are real.</p>

      <div className="redacted-quote">
        <span className="redact">████</span>{" "}
        "I made 21 calls. I never found a therapist. My son is dead."
        <cite>
          — Barbara Coutinho, whose son Ravi died after his insurer's ghost network denied him care.
          ProPublica / Fierce Healthcare, 2025.
        </cite>
      </div>

      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <h2>Start your audit</h2>

        <div style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="carrier">Insurance carrier</label>
          <select id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
            {CARRIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "0.85rem" }}>
          <label htmlFor="zip">ZIP code</label>
          <input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={12} />
        </div>

        <div style={{ marginBottom: "1.25rem" }}>
          <label>Care needs</label>
          <div className="chips">
            {CARE_OPTIONS.map((c) => (
              <button type="button" key={c} className={`chip ${needs.includes(c) ? "on" : ""}`} onClick={() => toggle(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {err ? <p className="err" style={{ marginBottom: "0.75rem" }}>{err}</p> : null}

        <button
          type="button"
          className={`btn full${!busy ? " cta" : ""}`}
          disabled={busy}
          onClick={() => void start()}
          style={{ fontSize: "0.85rem", padding: "0.85rem" }}
        >
          {initiating ? `Initiating ${providerCount} calls…` : "Start calling →"}
        </button>

        <button
          type="button"
          className="btn full secondary"
          disabled={busy}
          onClick={() => nav(`/audit/${DEMO_AUDIT_ID}`)}
          style={{ fontSize: "0.75rem", padding: "0.6rem", marginTop: "0.5rem" }}
        >
          Watch demo (no calls placed) →
        </button>
      </div>

      <p style={{ fontSize: "0.65rem", color: "var(--muted)", lineHeight: 1.8, textAlign: "center" }}>
        No account needed. We call every listed provider on your behalf.<br />
        Results in ~90 seconds. Your data is deleted after 30 days.
      </p>
    </div>
  );
}
