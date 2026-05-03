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
    themeUseDark: "Dark",
    themeUseLight: "Light",
    themeAriaDark: "Switch to dark theme",
    themeAriaLight: "Switch to light theme",
    stepperLabel: "Audit progress",
    stepperLive: "Live calls",
    stepperShortlist: "Shortlist",
    stepperResults: "Full results",
    navHome: "Home",
    navHow: "How it works",
    navPricing: "Pricing",
    navLogin: "Log in",
    navAppHome: "My workspace",
    homeEyebrow: "Audit your insurance directory",
    homeTitle: "Find providers your plan actually covers — before you need them.",
    homeLede:
      "We place real verification calls to your carrier’s sample directory and tell you which listings are usable. Built with patients and HR teams in mind.",
    homeCtaSignup: "Get started",
    homeCtaLogin: "Log in",
    homeTrust: "Not medical or legal advice. In crisis? Call or text 988.",
    homeWhoTitle: "Who it’s for",
    homePatientEyebrow: "For patients",
    homePatientTitle: "Stop chasing dead listings.",
    homePatientBody:
      "Run a single audit on your plan’s in-network behavioral-health directory. See which providers actually answer, accept your plan, and take new patients.",
    homePatientCta: "I’m auditing for myself",
    homeEmployerEyebrow: "For employers / HR",
    homeEmployerTitle: "Hard numbers for renewal conversations.",
    homeEmployerBody:
      "Show ghost rates by carrier, broken specialties, and a conservative productivity-loss exposure sketch — all from illustrative aggregates.",
    homeEmployerCta: "I’m auditing for an organization",
    homeWhatTitle: "What you get",
    homeWhatBullet1: "Ghost-rate, real-rate, and voicemail breakdown for the audited sample.",
    homeWhatBullet2: "A shortlist of listings that passed live verification.",
    homeWhatBullet3: "Optional draft complaint letter when the result warrants it.",
    homeLearnMore: "How it works",
    homePricingCta: "See pricing",
    homeTrustTitle: "About this tool",
    homeTrustBody:
      "Ghost Network Buster is an educational research project. Results describe what staff said on the call — they are not a guarantee of coverage and are not legal or medical advice.",
    homeTrustCrisis: "If you are in crisis, call or text",
    pricingEyebrow: "Pricing",
    pricingTitle: "Pay per audit. No subscription.",
    pricingLede:
      "One flat fee per audit, no monthly minimums. Audits include the live calls, shortlist, and downloadable summary.",
    pricingCardEyebrow: "Per-audit credit",
    pricingPerAudit: "/ audit",
    pricingIncl1: "Live verification calls against your carrier’s directory sample",
    pricingIncl2: "Shortlist of listings that passed verification",
    pricingIncl3: "Downloadable PDF summary and CSV of all calls",
    pricingIncl4: "Draft complaint letter when the result qualifies",
    pricingCta: "Sign up to get started",
    pricingNote: "Demo checkout in this build — no card is charged.",
    pricingFaqTitle: "Frequently asked",
    pricingFaq1Q: "Does this guarantee my plan will pay?",
    pricingFaq1A:
      "No. We tell you what reception said on the call. Always reconfirm coverage with your plan before booking.",
    pricingFaq2Q: "Can I run more than one audit?",
    pricingFaq2A: "Yes — buy another credit any time from your account menu.",
    pricingFaq3Q: "Do you store my health information?",
    pricingFaq3A:
      "We store the carrier, plan label, ZIP, and call transcripts — never diagnoses or claims. See the privacy summary for retention details.",
    howEyebrow: "How it works",
    howTitle: "Three steps from listing to live verification.",
    howLede: "Most audits finish in under two minutes from start to summary.",
    howStep1Title: "Pick your carrier and plan",
    howStep1Body:
      "Tell us the insurance carrier, the type of plan on your card, and your ZIP. We use the ZIP for directory context — never a street address.",
    howStep2Title: "We place parallel verification calls",
    howStep2Body:
      "Our voice agent calls a sample of in-network listings, asks scripted intake questions, and records a transcript of each call.",
    howStep3Title: "You get a clear summary",
    howStep3Body:
      "Real, ghost, voicemail, and error counts plus a usable shortlist. If the rate is high enough, you can download a draft complaint letter.",
    howPreviewCaption:
      "Each tile is a real call result with a transcript. Filter, search, and pin transcripts inside the live dashboard.",
    howCtaSignup: "Get started",
    howCtaPricing: "See pricing",
    authLoginEyebrow: "Welcome back",
    authLoginTitle: "Log in to your workspace",
    authSignupEyebrow: "Create your account",
    authSignupTitle: "Sign up to start an audit",
    authDemoNotice:
      "Demo build — credentials are stored in your browser only and no real password check is performed.",
    authEmail: "Work or personal email",
    authPassword: "Password",
    authLoginCta: "Continue",
    authSignupCta: "Create account",
    authLoginNoAccount: "New here?",
    authSignupHaveAccount: "Already have an account?",
    authSignupLink: "Sign up",
    authLoginLink: "Log in",
    authErrEmail: "Enter a valid email address.",
    authErrPassword: "Enter your password.",
    authErrPasswordMin: "Password must be at least 6 characters.",
    authRoleQuestion: "I’m auditing for:",
    roleSelf: "Myself",
    roleSelfBody: "I’m looking for in-network care for me or someone in my household.",
    roleEmployer: "An organization",
    roleEmployerBody: "I evaluate networks for employees, members, or a benefits team.",
    checkoutEyebrow: "Checkout",
    checkoutTitle: "Buy 1 audit credit",
    checkoutItem: "1 audit credit",
    checkoutTotal: "Total",
    checkoutWhat: "Audit credits never expire. You can run an audit immediately after checkout.",
    checkoutPay: "Pay ${price} (demo)",
    checkoutProcessing: "Processing…",
    checkoutCancel: "Cancel and return to workspace",
    appLogout: "Log out",
    appBuyCredits: "Buy more credits",
    appWorkspacePatient: "Patient workspace",
    appWorkspaceEmployer: "Employer workspace",
    creditsLabel: "credits",
    patientHomeEyebrow: "Patient workspace",
    patientHomeGreeting: "Welcome, {email}.",
    patientHomeBody:
      "Each audit places live verification calls against a sample of your carrier’s in-network directory. One credit covers one audit run.",
    patientHomeStartCta: "Start a new audit",
    patientHomeBuyAndStartCta: "Buy a credit to start",
    patientHomeDemoCta: "Watch demo (no calls)",
    patientHomeRecentTitle: "Recent audits",
    patientHomeRecentEmpty:
      "Audit history per account is coming soon. For now, results stay accessible from the link you receive at the end of an audit.",
    employerWorkspaceTitle: "Employer workspace",
    employerWorkspaceBody:
      "All figures below are illustrative aggregates with no PHI and are not tied to live patient audits. Useful for renewal storytelling.",
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
    themeUseDark: "Oscuro",
    themeUseLight: "Claro",
    themeAriaDark: "Cambiar a tema oscuro",
    themeAriaLight: "Cambiar a tema claro",
    stepperLabel: "Progreso de la auditoría",
    stepperLive: "Llamadas en vivo",
    stepperShortlist: "Lista corta",
    stepperResults: "Resultados completos",
    navHome: "Inicio",
    navHow: "Cómo funciona",
    navPricing: "Precios",
    navLogin: "Iniciar sesión",
    navAppHome: "Mi espacio",
    homeEyebrow: "Audite el directorio de su seguro",
    homeTitle: "Encuentre proveedores que su plan realmente cubre, antes de necesitarlos.",
    homeLede:
      "Hacemos llamadas reales de verificación al directorio de muestra de su aseguradora y le decimos qué contactos son útiles.",
    homeCtaSignup: "Empezar",
    homeCtaLogin: "Iniciar sesión",
    homeTrust: "No es asesoría médica ni legal. ¿En crisis? Llame o envíe SMS al 988.",
    homeWhoTitle: "Para quién es",
    homePatientEyebrow: "Para pacientes",
    homePatientTitle: "Deje de perseguir contactos muertos.",
    homePatientBody:
      "Realice una auditoría del directorio de salud conductual de su plan. Vea quién contesta, acepta su plan y recibe pacientes nuevos.",
    homePatientCta: "Audito para mí",
    homeEmployerEyebrow: "Para empleadores / RR. HH.",
    homeEmployerTitle: "Datos para conversaciones de renovación.",
    homeEmployerBody:
      "Tasas de fantasma por aseguradora, especialidades rotas y una estimación conservadora de exposición — solo agregados ilustrativos.",
    homeEmployerCta: "Audito para una organización",
    homeWhatTitle: "Qué obtiene",
    homeWhatBullet1: "Desglose de tasas: real, fantasma y buzón de voz.",
    homeWhatBullet2: "Una lista corta de contactos verificados.",
    homeWhatBullet3: "Borrador opcional de queja cuando el resultado lo amerita.",
    homeLearnMore: "Cómo funciona",
    homePricingCta: "Ver precios",
    homeTrustTitle: "Sobre esta herramienta",
    homeTrustBody:
      "Ghost Network Buster es un proyecto educativo. Reflejamos lo dicho en la llamada — no garantiza cobertura ni es asesoría legal/médica.",
    homeTrustCrisis: "Si hay crisis, llame o envíe SMS al",
    pricingEyebrow: "Precios",
    pricingTitle: "Pago por auditoría. Sin suscripción.",
    pricingLede:
      "Un solo precio por auditoría, sin mínimos mensuales. Incluye llamadas, lista corta y resumen descargable.",
    pricingCardEyebrow: "Crédito por auditoría",
    pricingPerAudit: "/ auditoría",
    pricingIncl1: "Llamadas en vivo a la muestra del directorio de su aseguradora",
    pricingIncl2: "Lista corta de contactos verificados",
    pricingIncl3: "PDF descargable y CSV de todas las llamadas",
    pricingIncl4: "Borrador de queja cuando aplica",
    pricingCta: "Crear cuenta",
    pricingNote: "Pago de demostración — no se cobra ninguna tarjeta.",
    pricingFaqTitle: "Preguntas frecuentes",
    pricingFaq1Q: "¿Garantiza que mi plan pagará?",
    pricingFaq1A:
      "No. Reflejamos lo que recepción dijo en la llamada. Siempre reconfirme la cobertura con su plan antes de reservar.",
    pricingFaq2Q: "¿Puedo correr más de una auditoría?",
    pricingFaq2A: "Sí — compre otro crédito en cualquier momento desde el menú de su cuenta.",
    pricingFaq3Q: "¿Almacenan mi información médica?",
    pricingFaq3A:
      "Guardamos aseguradora, etiqueta del plan, ZIP y transcripciones — nunca diagnósticos ni reclamos.",
    howEyebrow: "Cómo funciona",
    howTitle: "Tres pasos: del listado a la verificación en vivo.",
    howLede: "La mayoría de auditorías terminan en menos de dos minutos.",
    howStep1Title: "Elija aseguradora y plan",
    howStep1Body:
      "Indíquenos la aseguradora, el tipo de plan en su tarjeta y el ZIP. Usamos el ZIP solo para contexto del directorio.",
    howStep2Title: "Llamadas paralelas de verificación",
    howStep2Body:
      "Nuestro agente de voz llama a una muestra del directorio en red, hace preguntas de intake y guarda la transcripción.",
    howStep3Title: "Recibe un resumen claro",
    howStep3Body:
      "Conteos real, fantasma, buzón y error, más una lista corta útil. Si la tasa es alta, descargue un borrador de queja.",
    howPreviewCaption:
      "Cada tarjeta es un resultado real de llamada con su transcripción. Filtre, busque y fije transcripciones en el panel en vivo.",
    howCtaSignup: "Empezar",
    howCtaPricing: "Ver precios",
    authLoginEyebrow: "Bienvenido",
    authLoginTitle: "Inicie sesión",
    authSignupEyebrow: "Crear cuenta",
    authSignupTitle: "Cree su cuenta para empezar",
    authDemoNotice:
      "Build de demostración: las credenciales se guardan solo en su navegador y no hay verificación real de contraseña.",
    authEmail: "Correo electrónico",
    authPassword: "Contraseña",
    authLoginCta: "Continuar",
    authSignupCta: "Crear cuenta",
    authLoginNoAccount: "¿Eres nuevo?",
    authSignupHaveAccount: "¿Ya tienes una cuenta?",
    authSignupLink: "Crear cuenta",
    authLoginLink: "Iniciar sesión",
    authErrEmail: "Ingrese un correo válido.",
    authErrPassword: "Ingrese su contraseña.",
    authErrPasswordMin: "La contraseña debe tener al menos 6 caracteres.",
    authRoleQuestion: "Audito para:",
    roleSelf: "Mí mismo",
    roleSelfBody: "Busco atención en red para mí o mi hogar.",
    roleEmployer: "Una organización",
    roleEmployerBody: "Evalúo redes para empleados o un equipo de beneficios.",
    checkoutEyebrow: "Pago",
    checkoutTitle: "Compre 1 crédito de auditoría",
    checkoutItem: "1 crédito de auditoría",
    checkoutTotal: "Total",
    checkoutWhat: "Los créditos no caducan. Puede iniciar una auditoría inmediatamente.",
    checkoutPay: "Pagar ${price} (demo)",
    checkoutProcessing: "Procesando…",
    checkoutCancel: "Cancelar y volver al espacio",
    appLogout: "Cerrar sesión",
    appBuyCredits: "Comprar más créditos",
    appWorkspacePatient: "Espacio de paciente",
    appWorkspaceEmployer: "Espacio de empleador",
    creditsLabel: "créditos",
    patientHomeEyebrow: "Espacio de paciente",
    patientHomeGreeting: "Bienvenido, {email}.",
    patientHomeBody:
      "Cada auditoría llama a una muestra del directorio en red de su aseguradora. Un crédito cubre una auditoría.",
    patientHomeStartCta: "Iniciar nueva auditoría",
    patientHomeBuyAndStartCta: "Comprar un crédito para empezar",
    patientHomeDemoCta: "Ver demo (sin llamadas)",
    patientHomeRecentTitle: "Auditorías recientes",
    patientHomeRecentEmpty:
      "Pronto: historial por cuenta. Por ahora, los resultados se acceden desde el enlace que recibe al final.",
    employerWorkspaceTitle: "Espacio de empleador",
    employerWorkspaceBody:
      "Todas las cifras son agregados ilustrativos sin PHI y no están vinculadas a auditorías reales.",
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
