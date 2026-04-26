import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../api";

const CARE_OPTIONS = [
  "Trauma",
  "ADHD",
  "Anxiety",
  "Depression",
  "LGBTQ+ affirming",
  "Spanish-speaking",
  "EMDR",
  "Substance use",
];

export default function Landing() {
  const nav = useNavigate();
  const [carrier, setCarrier] = useState("Aetna");
  const [zip, setZip] = useState("10001");
  const [needs, setNeeds] = useState<string[]>(["Trauma", "Anxiety"]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (n: string) => {
    setNeeds((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  };

  const subtitle = useMemo(
    () =>
      "Run a mock directory audit: parallel AI calls (simulated in dev), live ghost-rate dashboard, PDF summary, and complaint draft when ghost rate is high.",
    [],
  );

  async function start() {
    setErr(null);
    setBusy(true);
    try {
      const { audit_id } = await apiPost<{ audit_id: string }>("/api/start-audit", {
        carrier,
        zip_code: zip,
        care_needs: needs,
        email: email.trim() || null,
      });
      nav(`/audit/${audit_id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start audit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Find real therapists. Expose ghost listings.</h1>
      <p className="lede">{subtitle}</p>
      <div className="banner">
        <strong>Dev mode:</strong> voice is mocked (no Retell/Twilio charges). Sample NYC-style
        directory: 10 providers; ghost rate targets ~70% so the complaint draft unlocks.
      </div>
      <div className="grid grid-2">
        <div className="card">
          <h2>Your search</h2>
          <div style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="carrier">Carrier</label>
            <select id="carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
              <option>Aetna</option>
              <option>BCBS</option>
              <option>Cigna</option>
              <option>UHC</option>
              <option>Oscar</option>
            </select>
          </div>
          <div style={{ marginBottom: "0.85rem" }}>
            <label htmlFor="zip">ZIP code</label>
            <input id="zip" value={zip} onChange={(e) => setZip(e.target.value)} maxLength={12} />
          </div>
          <div style={{ marginBottom: "0.85rem" }}>
            <label>Care needs</label>
            <div className="chips">
              {CARE_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`chip ${needs.includes(c) ? "on" : ""}`}
                  onClick={() => toggle(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="email">Email (optional)</label>
            <input
              id="email"
              type="email"
              placeholder="for future HTML summary delivery"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {err ? <p className="err">{err}</p> : null}
          <button type="button" className="btn" disabled={busy} onClick={() => void start()}>
            {busy ? "Starting…" : "Start audit"}
          </button>
        </div>
        <div className="card">
          <h2>Deliverables (MVP)</h2>
          <ul className="lede" style={{ paddingLeft: "1.1rem", marginTop: 0 }}>
            <li>Live dashboard: ghost %, per-call tiles, transcripts as they finish</li>
            <li>Results: top verified providers, verification timestamps, audio note in mock</li>
            <li>Shareable path: <span className="mono">/results/&lt;auditId&gt;</span> (in-memory server)</li>
            <li>PDF audit summary; complaint draft if ghost rate ≥ 70%</li>
            <li>Employer view: illustrative ghost-rate-by-carrier + renewal narrative</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
