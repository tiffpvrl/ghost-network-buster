import type { CSSProperties } from "react";
import { useLocale } from "../locale";

export default function StatusLegend({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  const style: CSSProperties = compact
    ? { fontSize: "0.68rem", color: "var(--muted)", lineHeight: 1.55, marginBottom: "1rem" }
    : { fontSize: "0.72rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: "1.25rem" };

  return (
    <aside className="status-legend" style={style} aria-label={t("legendTitle")}>
      <div style={{ fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.35rem", color: "var(--text)" }}>
        {t("legendTitle")}
      </div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
        <li style={{ marginBottom: "0.2rem" }}>{t("legendReal")}</li>
        <li style={{ marginBottom: "0.2rem" }}>{t("legendGhost")}</li>
        <li style={{ marginBottom: "0.2rem" }}>{t("legendUnconfirmed")}</li>
        <li>{t("legendError")}</li>
      </ul>
    </aside>
  );
}
