import { Link } from "react-router-dom";
import { useLocale } from "../locale";

type Props = {
  auditId: string;
  doneAll: boolean;
  failed: boolean;
  realCount: number;
};

/**
 * One compact “where you are” indicator: live audit → shortlist activity → full results.
 */
export default function AuditStepper({ auditId, doneAll, failed, realCount }: Props) {
  const { t } = useLocale();
  let current: 1 | 2 | 3 = 1;
  if (doneAll && !failed) current = 3;
  else if (!failed && realCount > 0) current = 2;

  return (
    <nav className="stepper print-hidden" aria-label={t("stepperLabel")}>
      <span className="stepper-step" aria-current={current === 1 ? "step" : undefined}>
        <span className="stepper-dot" aria-hidden />
        {t("stepperLive")}
      </span>
      <span className="stepper-sep" aria-hidden>
        —
      </span>
      <span className="stepper-step" aria-current={current === 2 ? "step" : undefined}>
        <span className="stepper-dot" aria-hidden />
        {t("stepperShortlist")}
      </span>
      <span className="stepper-sep" aria-hidden>
        —
      </span>
      {doneAll && !failed ? (
        <Link className="stepper-step stepper-link" aria-current={current === 3 ? "step" : undefined} to={`/results/${auditId}`}>
          <span className="stepper-dot" aria-hidden />
          {t("stepperResults")}
        </Link>
      ) : (
        <span className="stepper-step" aria-current={current === 3 ? "step" : undefined}>
          <span className="stepper-dot" aria-hidden />
          {t("stepperResults")}
        </span>
      )}
    </nav>
  );
}
