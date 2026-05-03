import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "gnb_locale";

export type Locale = "en" | "es";

const DICT: Record<Locale, Record<string, string>> = {
  en: {
    langToggle: "Español",
    langToggleEs: "English",
    skipToMain: "Skip to main content",
    navPatientAudit: "Patient audit",
    navEmployer: "Employer",
    navBrand: "Ghost Network Buster",
    crisis988: "988 Suicide & Crisis Lifeline",
    crisis988Short: "If you are in crisis, call or text",
    crisisLinks: "988lifeline.org",
    crisisNyc: "NYC Well",
    noticesTitle: "Crisis & sharing",
    shareModalTitle: "Share this link?",
    shareModalBody:
      "Anyone with your results link may be able to read call transcripts and provider details. Do not post publicly or share with people you do not trust.",
    shareModalCancel: "Cancel",
    shareModalCopy: "Copy link",
    shareModalCopied: "Copied",
    copyShareButton: "Copy share link",
    loading: "Loading…",
    loadingResults: "Loading results…",
    linkExpiredTitle: "This results link has expired",
    linkExpiredBody:
      "Shared audit links stop working after the retention period on the server. Start a new audit from the home page.",
    genericErrorTitle: "Could not load results",
    genericErrorBody: "Try again, or start a new audit from the home page.",
    noticesShareOnly:
      "Anyone with this link may read transcripts and provider details — do not post publicly.",
    authErrorTitle: "Could not authorize",
    authErrorBody:
      "The server rejected this request. If your deployment uses a demo API key, set the same value in your frontend environment as VITE_DEMO_API_KEY.",
    newAudit: "← New audit",
    resultsMetaComplete: "Audit complete",
    resultsH1Usable: "We found {n} usable listings — out of {total} audited.",
    resultsH1HighGhost: "Most verified listings look unusable, but {n} may work — out of {total} audited.",
    resultsH1Zero: "No usable listings in this run — {total} audited.",
    resultsLedeMixed:
      "Many directory rows did not hold up on a live call. The shortlist below may still help — confirm every detail before booking.",
    zeroResultsTitle: "This result can be hard to carry alone",
    zeroResultsBody:
      "If you can, use 988 for immediate support. You can still download the call log and a complaint draft (if available) to document inaccurate listings for your plan. This tool does not give medical or legal advice.",
    verifyContextNote: "Verification referenced {carrier}. {plan}{card}Reception answers describe network and intake only at call time.",
    planTypePrefix: "Plan type: {type}. ",
    memberCardPrefix: "Plan on card: {label}. ",
    shortlistHeading: "Shortlist (usable in this run)",
    shortlistEmpty: "No listings met the usable bar in this audit.",
    allCallsHeading: "All calls",
    downloadsHeading: "Downloads & sharing",
    downloadPdf: "Download audit summary (PDF)",
    downloadCsv: "Download results (CSV)",
    downloadComplaint: "Download complaint draft",
    complaintGenerating: "Generating…",
    regulatoryAlert:
      "A high share of unreachable or inaccurate listings may be worth reporting to your state insurance department or the plan. Consider reviewing official complaint options with a qualified advocate or attorney; we do not provide legal advice.",
    legendTitle: "Call outcomes",
    legendReal: "Real — reception indicated this listing was usable for your inquiry.",
    legendGhost: "Ghost — wrong number, wrong network, closed panel, or other dead directory row.",
    legendUnconfirmed: "Voicemail / no answer — not confirmed; not the same as “ghost.”",
    legendError: "Error — technical issue on the call; retry or verify manually.",
    landingSubtitleWithCount:
      "This sample lists {count} providers. We place parallel verification calls and show how many listings look usable.",
    landingSubtitleGeneric:
      "We place parallel verification calls to your insurer’s sample directory and show how many listings look usable.",
    landingWhyExists: "Why this exists",
    landingStart: "Start your audit",
    landingCarrier: "Insurance carrier",
    landingCarrierOther: "Carrier name (as on your card)",
    landingPlanType: "Plan type (interprets results)",
    landingMemberPlan: "Plan name on card (optional)",
    landingZip: "ZIP code",
    landingZipHint: "We use ZIP for directory context only — no street address.",
    landingZipErr: "Use 5 digits or ZIP+4 format.",
    landingCareNeeds: "Care needs",
    landingExpectTitle: "What to expect",
    landingExpectParallel: "Parallel outbound calls; you may hit voicemail after hours.",
    landingExpectDuration: "Rough duration: about {sec}s for {count} providers in this sample (estimate).",
    landingExpectDurationFallback: "Typical duration: {hint} for this environment.",
    landingExpectOutcome: "Outcomes reflect what staff said on the call — not a guarantee your plan will pay claims.",
    landingConsentCalls: "Terms of service (calls)",
    landingConsentPrivacy: "Privacy summary",
    landingStartBtn: "Start calling ({count})",
    landingStarting: "Starting {count} calls…",
    landingDemo: "Watch demo (no calls)",
    landingFooter: "No account needed.",
    landingFooterCount: "This build audits up to {count} sample listings.",
    landingFooterSize: "Sample size loads from the server.",
    landingFooterRetention: "Data retention: see privacy terms for your deployment.",
    employerBanner:
      "Illustrative only — mock aggregates, no PHI, not tied to live patient audits.",
    landingConsentRequired: "Please confirm consent and terms before starting.",
    landingOtherCarrierRequired: "Enter your carrier name, or choose a listed carrier.",
    legalDraftBanner:
      "Draft for educational deployments only — not legal advice. Have counsel review before production.",
    dashboardWsConnecting: "Establishing live connection…",
    dashboardMissingAudit: "Missing audit id.",
    resultsViewTranscript: "View transcript",
    resultsHideTranscript: "Hide transcript",
    resultsUsableBadge: "USABLE — reception reported in-network / intake as of {when}",
    resultsPhoneOnFile: "Phone on file:",
    resultsGhostBreakdown: "Ghost breakdown",
    resultsComplaintDraft: "Complaint draft →",
    resultsDownloading: "Downloading…",
  },
  es: {
    langToggle: "English",
    langToggleEs: "English",
    skipToMain: "Saltar al contenido principal",
    navPatientAudit: "Auditoría para pacientes",
    navEmployer: "Empleador",
    navBrand: "Ghost Network Buster",
    crisis988: "Línea 988",
    crisis988Short: "Si hay crisis, llame o envíe un mensaje de texto al",
    crisisLinks: "988lifeline.org",
    crisisNyc: "NYC Well",
    noticesTitle: "Crisis y uso de enlaces",
    shareModalTitle: "¿Compartir este enlace?",
    shareModalBody:
      "Cualquiera con el enlace puede leer transcripciones y datos del proveedor. No lo publique ni lo comparta con personas en las que no confíe.",
    shareModalCancel: "Cancelar",
    shareModalCopy: "Copiar enlace",
    shareModalCopied: "Copiado",
    copyShareButton: "Copiar enlace para compartir",
    loading: "Cargando…",
    loadingResults: "Cargando resultados…",
    linkExpiredTitle: "Este enlace de resultados ha caducado",
    linkExpiredBody:
      "Los enlaces compartidos dejan de funcionar tras el periodo de retención del servidor. Inicie una nueva auditoría desde la página principal.",
    genericErrorTitle: "No se pudieron cargar los resultados",
    genericErrorBody: "Intente de nuevo o inicie una nueva auditoría desde la página principal.",
    noticesShareOnly:
      "Cualquiera con este enlace puede leer transcripciones y datos del proveedor — no lo publique.",
    authErrorTitle: "No se pudo autorizar",
    authErrorBody:
      "El servidor rechazó la solicitud. Si usa una clave de demostración, configure el mismo valor en VITE_DEMO_API_KEY.",
    newAudit: "← Nueva auditoría",
    resultsMetaComplete: "Auditoría completa",
    resultsH1Usable: "Encontramos {n} contactos posiblemente útiles — de {total} auditados.",
    resultsH1HighGhost: "La mayoría parece inusable, pero {n} podrían servir — de {total} auditados.",
    resultsH1Zero: "Ningún contacto útil en esta ronda — {total} auditados.",
    resultsLedeMixed:
      "Muchas filas del directorio no se confirmaron por teléfono. La lista corta aún puede ayudar — confirme todo antes de reservar.",
    zeroResultsTitle: "Llevar este resultado puede ser muy difícil",
    zeroResultsBody:
      "Si puede, use el 988 para apoyo inmediato. Aún puede descargar el registro de llamadas y un borrador de queja (si aplica). Esta herramienta no es asesoría médica ni legal.",
    verifyContextNote:
      "Las llamadas mencionaron {carrier}. {plan}{card}Lo que dijo recepción describe la red solo al momento de la llamada.",
    planTypePrefix: "Tipo de plan: {type}. ",
    memberCardPrefix: "Plan en la tarjeta: {label}. ",
    shortlistHeading: "Lista corta (útiles en esta ronda)",
    shortlistEmpty: "Ningún contacto cumplió el criterio de “útil” en esta auditoría.",
    allCallsHeading: "Todas las llamadas",
    downloadsHeading: "Descargas y compartir",
    downloadPdf: "Resumen (PDF)",
    downloadCsv: "Resultados (CSV)",
    downloadComplaint: "Borrador de queja",
    complaintGenerating: "Generando…",
    regulatoryAlert:
      "Muchas filas inalcanzables o incorrectas pueden ser motivo de reporte ante el departamento de seguros del estado o el plan. Revise opciones oficiales de quejas con un defensor o abogado; no ofrecemos asesoría legal.",
    legendTitle: "Resultados de llamadas",
    legendReal: "Real — recepción indicó que el contacto sirvió para su consulta.",
    legendGhost:
      "Fantasma — número incorrecto, red incorrecta, panel cerrado u otro dato inválido.",
    legendUnconfirmed:
      "Buzón de voz / sin respuesta — no confirmado; no es lo mismo que “fantasma”.",
    legendError: "Error — problema técnico en la llamada; verifique de nuevo.",
    landingSubtitleWithCount:
      "Esta muestra lista {count} proveedores. Hacemos llamadas en paralelo para ver cuántos contactos parecen útiles.",
    landingSubtitleGeneric:
      "Hacemos llamadas en paralelo al directorio de muestra de su aseguradora para ver cuántos contactos parecen útiles.",
    landingWhyExists: "Por qué existe",
    landingStart: "Iniciar su auditoría",
    landingCarrier: "Aseguradora",
    landingCarrierOther: "Nombre de la aseguradora (como en su tarjeta)",
    landingPlanType: "Tipo de plan (interpreta resultados)",
    landingMemberPlan: "Nombre del plan en la tarjeta (opcional)",
    landingZip: "Código postal",
    landingZipHint: "Solo ZIP — sin dirección física.",
    landingZipErr: "Use 5 dígitos o ZIP+4.",
    landingCareNeeds: "Necesidades de atención",
    landingExpectTitle: "Qué esperar",
    landingExpectParallel: "Llamadas en paralelo; puede caer en buzón de voz fuera de horario.",
    landingExpectDuration: "Duración aprox.: ~{sec}s para {count} proveedores en esta muestra.",
    landingExpectDurationFallback: "Duración típica: {hint} en este entorno.",
    landingExpectOutcome:
      "Lo que dijo el personal es solo en el momento de la llamada — no garantiza pago.",
    landingConsentCalls: "Términos (llamadas)",
    landingConsentPrivacy: "Privacidad",
    landingStartBtn: "Iniciar llamadas ({count})",
    landingStarting: "Iniciando {count} llamadas…",
    landingDemo: "Ver demo (sin llamadas)",
    landingFooter: "No se requiere cuenta.",
    landingFooterCount: "Esta versión audita hasta {count} contactos de muestra.",
    landingFooterSize: "El tamaño de la muestra carga del servidor.",
    landingFooterRetention: "Conservación de datos: vea la privacidad del despliegue.",
    employerBanner:
      "Solo ilustrativo: datos simulados, sin PHI, no ligado a auditorías reales.",
    landingConsentRequired: "Confirme el consentimiento y los términos antes de continuar.",
    landingOtherCarrierRequired: "Escriba el nombre de la aseguradora o elija una de la lista.",
    legalDraftBanner:
      "Borrador solo para fines educativos — no es asesoría legal.",
    dashboardWsConnecting: "Estableciendo conexión en vivo…",
    dashboardMissingAudit: "Falta el id de auditoría.",
    resultsViewTranscript: "Ver transcripción",
    resultsHideTranscript: "Ocultar transcripción",
    resultsUsableBadge: "ÚTIL — recepción confirmó red/intake el {when}",
    resultsPhoneOnFile: "Teléfono registrado:",
    resultsGhostBreakdown: "Desglose de “fantasmas”",
    resultsComplaintDraft: "Borrador de queja →",
    resultsDownloading: "Descargando…",
  },
};

function storedLocale(): Locale {
  if (typeof window === "undefined") return "en";
  return window.localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en";
}

type LocaleValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(storedLocale);
  const setLocale = useCallback((l: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, l);
    setLocaleState(l);
  }, []);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICT[locale][key] ?? DICT.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [locale],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
