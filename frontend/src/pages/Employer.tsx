import { useEffect, useState } from "react";
import type { EmployerDashboard } from "../api";
import { apiGet } from "../api";

export default function Employer() {
  const [data, setData] = useState<EmployerDashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await apiGet<EmployerDashboard>("/api/employer/mock-dashboard");
        if (!cancelled) {
          setData(d);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Load failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (err) return <p className="err">{err}</p>;
  if (!data) return <p className="lede">Loading employer snapshot…</p>;

  const headcount = data.example_headcount;
  const frac = data.example_untreated_fraction;
  const exposure = Math.round(headcount * frac * data.exposure_usd_per_untreated_annual);

  return (
    <div>
      <h1>Employer / HR view</h1>
      <p className="lede">
        Illustrative aggregates only — no employee PHI. Designed for renewal conversations:
        ghost-rate-by-carrier, specialty gaps, and a rough productivity exposure anchor.
      </p>
      <div className="banner">{data.renewal_lever}</div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Ghost rate by carrier</h2>
          {data.ghost_rate_by_carrier.map((row) => (
            <div key={row.carrier} className="bar-row">
              <div className="lbl">{row.carrier}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(100, row.ghost_rate * 100)}%` }} />
              </div>
              <div style={{ width: "42px", textAlign: "right", fontSize: "0.85rem" }}>
                {Math.round(row.ghost_rate * 100)}%
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Exposure sketch</h2>
          <p style={{ marginTop: 0, color: "var(--muted)", lineHeight: 1.5 }}>
            Using an illustrative {Math.round(frac * 100)}% of {headcount} employees potentially
            unable to access care, and ~${data.exposure_usd_per_untreated_annual.toLocaleString()} /
            year productivity loss per untreated behavioral-health case (planning doc anchor — tune
            for your CFO narrative).
          </p>
          <div className="kpi">
            <div className="val">${exposure.toLocaleString()}</div>
            <div className="lbl">Illustrative annual exposure</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>Broken specialties (examples)</h2>
        <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)", lineHeight: 1.55 }}>
          {data.broken_specialties.map((b) => (
            <li key={b.label}>
              <strong style={{ color: "var(--text)" }}>{b.label}</strong> — real providers within 25
              mi: {b.real_providers_within_25mi}; employees affected (est.):{" "}
              {b.employees_affected_estimate}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
