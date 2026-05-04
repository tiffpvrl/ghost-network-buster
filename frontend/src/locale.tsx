import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";

export type Locale = "en";

const DICT: Record<Locale, Record<string, string>> = {
  en: {
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
    pricingTitle: "Built for two very different motivations.",
    pricingLede:
      "Patients pay only when they want results they can act on. Employers pay for compliance evidence they can put in a filing cabinet.",
    pricingIndividualsTitle: "For individuals",
    pricingIndividualsLead: "Free to run · pay only to unlock results that matter to you.",
    pricingUnlockTitle: "Audit unlock",
    pricingUnlockUnit: "/ audit",
    pricingUnlockBody:
      "Unlock the full shortlist of usable providers from your audit run. One-time charge per audit — no subscription.",
    pricingBundleTitle: "Full Report + Complaint Letter",
    pricingBundleUnit: "/ bundle",
    pricingBundleBody:
      "Everything in Audit unlock, plus a downloadable, statute-cited complaint draft you can take to your state insurance department.",
    pricingIndividualsParagraph:
      "Patients run the audit for free and see 1–2 provider results (either ghost or not). To unlock the full shortlist and download the complaint letter, they pay $4.99 per audit. No subscription — patients don’t audit monthly, they audit once when they’re desperate. The gate is placed at exactly the moment of maximum motivation: they’ve just watched 6 out of 8 listings come back as ghosts and there are 2 real providers they can’t yet see. A $12.99 “Full Report + Complaint Letter” bundle is offered for patients who want to escalate to their state insurance department — a meaningfully different intent that commands a higher price. The mental anchor is one therapy copay (~$30–50); $4.99 is an impulse buy by comparison.",
    pricingBusinessesTitle: "For businesses",
    pricingBusinessesLead:
      "Compliance-grade audits, packaged for renewal and regulator-ready filing.",
    pricingTierStarterName: "Starter",
    pricingTierStarterPrice: "$299",
    pricingTierStarterBody:
      "100–500 employees · 1 carrier audit / month · PDF compliance report.",
    pricingTierGrowthName: "Growth",
    pricingTierGrowthPrice: "$799",
    pricingTierGrowthBody:
      "500–2,000 employees · 3 carriers · multi-ZIP · quarterly trend reports.",
    pricingTierEnterpriseName: "Enterprise",
    pricingTierEnterprisePrice: "Custom",
    pricingTierEnterpriseBody:
      "2,000+ employees · unlimited carriers · API access · regulator-ready filing package (~$2,000–4,000 / month).",
    pricingTierMonthly: "/ month",
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
    pricingCta: "Sign up to get started",
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
    appWorkspacePatient: "Dashboard",
    appWorkspaceEmployer: "Employer workspace",
    creditsLabel: "credits",
    patientHomeEyebrow: "Dashboard",
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

    cancel: "Cancel",

    // ── Paywall (results page) ─────────────────────────────────
    paywallTitle: "Unlock your shortlist",
    paywallBody:
      "Names, phone numbers, transcripts, and verification details are hidden until you unlock this audit. One-time charge — no subscription.",
    paywallShortlistTeaser:
      "You can see 1 of {total} usable provider listings. Unlock to see the other {locked} — names, phone numbers, and call transcripts.",
    paywallFreePreviewLede:
      "Here's 1 confirmed real provider for free. {locked} more are blurred until you unlock this audit.",
    paywallUnlockCta: "Unlock shortlist — $4.99",
    paywallBundleCta: "Unlock full results pack — $12.99",
    paywallComplaintCta: "Unlock results pack — $12.99",
    paywallComplaintCtaUpgrade: "Add results pack — $8",
    paywallFinePrint:
      "Demo checkout in this build — no card is charged. Unlock state is stored locally in your browser.",
    paywallDownloadsAddOnCta: "Unlock PDF, CSV & share — $8",
    paywallDownloadsBundleCta: "Unlock PDF, CSV, share & letter — $12.99",

    // ── Pre-run tier gate (patient live audit dashboard) ───────
    auditTierGateTitle: "Choose how you want to use this audit",
    auditTierGateSubtitle:
      "Pick a tier before the live progress view. You can still upgrade later from your results page.",
    auditTierFreeTitle: "Free",
    auditTierFreePrice: "$0",
    auditTierFreeBody:
      "See one confirmed usable provider on your results page. The rest of the shortlist stays blurred until you upgrade.",
    auditTierFreeCta: "Continue with Free",
    auditTierShortlistTitle: "Full shortlist",
    auditTierShortlistPrice: "$4.99",
    auditTierShortlistBody:
      "See every usable provider, names, transcripts, and the full call-by-call grid. PDF, CSV, share link, and complaint letter stay locked until you add the results pack.",
    auditTierShortlistCta: "Continue — $4.99",
    auditTierFullTitle: "Full results pack",
    auditTierFullPrice: "$12.99",
    auditTierFullBody:
      "Everything in the full shortlist, plus PDF summary, CSV export, shareable link, and statute-cited complaint draft.",
    auditTierFullCta: "Continue — $12.99",

    // ── Letter-only upgrade card (results page) ────────────────
    letterUpgradeTitle: "Add the results pack",
    letterUpgradeBody:
      "You unlocked the shortlist for $4.99. For $8 more, unlock PDF summary, CSV export, share link, and the statute-cited complaint draft — same total as the $12.99 bundle.",
    letterUpgradeCta: "Add results pack — $8",

    // ── Checkout plan registry ─────────────────────────────────
    checkoutPlanUnlockTitle: "Unlock the full shortlist",
    checkoutPlanUnlockWhat:
      "See the full list of usable providers from this audit, including names, phone numbers, and call transcripts.",
    checkoutPlanLetterTitle: "Add the results pack",
    checkoutPlanLetterWhat:
      "You already unlocked the shortlist for this audit. This adds PDF summary, CSV export, a shareable results link, and the statute-cited complaint draft for your state insurance department.",
    checkoutPlanBundleTitle: "Full results pack",
    checkoutPlanBundleWhat:
      "Full shortlist plus PDF summary, CSV export, shareable link, and statute-cited complaint draft — everything in one purchase.",
    checkoutPlanTierStarterTitle: "Starter — Employer plan",
    checkoutPlanTierStarterWhat:
      "100–500 employees · 1 carrier audit / month · PDF compliance report.",
    checkoutPlanTierGrowthTitle: "Growth — Employer plan",
    checkoutPlanTierGrowthWhat:
      "500–2,000 employees · 3 carriers · multi-ZIP · quarterly trend reports.",
    checkoutPlanTierEnterpriseTitle: "Enterprise — Employer plan",
    checkoutPlanTierEnterpriseWhat:
      "2,000+ employees · unlimited carriers · API access · regulator-ready filing package. Custom pricing.",
    checkoutPayLabel: "Pay {price} (demo)",
    checkoutContactSales: "Contact sales →",
    checkoutFallbackStarter: "Continue with Starter for now",

    // ── Employer audit form / batch flow ───────────────────────
    employerNewAuditEyebrow: "New employer audit",
    employerNewAuditTitle: "Audit your network across carriers and ZIPs",
    employerNewAuditLede:
      "Pick the carriers and ZIPs you want to audit. We fan out one verification audit per (carrier × ZIP) pair and aggregate the results into a single batch view.",
    employerTierBadge: "Active plan: {tier}",
    employerTierLabel: "{tier} plan",
    employerTierNone: "no plan selected",
    employerChangePlan: "Change plan",
    employerFormCarriersLabel: "Carriers to audit",
    employerFormZipsLabel: "ZIP codes",
    employerFormZipsHelp:
      "Newline- or comma-separated. We accept 5-digit ZIPs and ZIP+4.",
    employerFormInvalidZips: "Check these ZIPs: {list}",
    employerFormNeedsLabel: "Care needs (applies to every audit)",
    employerFormPlanTypeLabel: "Plan type",
    employerFormConsentRecord:
      "I confirm staff at sampled listings will receive automated verification calls in line with posted terms.",
    employerFormConsentTerms:
      "I acknowledge results describe what reception said on the call — not a guarantee of coverage.",
    employerFormSummary:
      "{carriers} carrier(s) × {zips} ZIP(s) = {total} audit(s).",
    employerFormCapWarning:
      "This batch would launch {total} audits, which exceeds the per-batch cap of {cap}. Reduce carriers or ZIPs.",
    employerFormSubmit: "Run batch",
    employerFormSubmitting: "Starting…",
    employerFormSubmitError:
      "Could not start any audits in this batch. Check your demo API key or server logs and try again.",

    batchEyebrow: "Employer batch",
    batchTitle: "Batch {id}",
    batchLede:
      "{carriers} carrier × {zips} ZIP = {total} audits. We poll each audit until completion.",
    batchKpiAudits: "Audits done",
    batchKpiGhostRate: "Ghost rate",
    batchKpiReal: "Real / usable",
    batchKpiCallsPlaced: "Calls placed",
    batchColCarrier: "Carrier",
    batchColZip: "ZIP",
    batchColCalls: "Calls",
    batchColGhost: "Ghost %",
    batchColStatus: "Status",
    batchRowLive: "Live →",
    batchRowOpen: "Open →",
    batchMissingTitle: "Batch not found",
    batchMissingBody:
      "This batch is not stored in your browser. If you ran it on another device, it will not appear here.",
    batchBackToEmployer: "← Back to workspace",

    employerHomeTitle: "Run an employer batch audit",
    employerHomeBody:
      "Audit one or more carriers across multiple ZIPs in a single batch. Results aggregate into compliance-ready KPIs.",
    employerHomeRunNewAudit: "Run a new audit",
    employerHomeSelectPlan: "Select a plan",
    employerHomeRecentTitle: "Recent batches",
    employerHomeRecentEmpty:
      "You have not run any batch audits yet. Start one to see ghost rates by carrier and ZIP.",
    employerHomeRecentMeta:
      "{carriers} carrier × {zips} ZIP · {total} audits",
    employerHomeReferenceTitle: "Reference data",
    employerHomeReferenceTag: "Illustrative — not from your audits",

    // ── Patient recent audits ─────────────────────────────────
    patientHomeRowMeta: "Plan: {plan} · Needs: {needs}",
    patientHomeRowGhost: "{pct}% ghost",

    // ── Employer audit executive drill-down ───────────────────
    employerDetailEyebrow: "Audit detail",
    employerDetailLede:
      "A compact, HR-grade view of this single audit. Aggregate signal only — per-call transcripts are not surfaced here.",
    employerDetailHighGhost: "High ghost rate",
    employerDetailKpiCalls: "Calls done",
    employerDetailKpiGhost: "Ghost rate",
    employerDetailKpiReal: "Real / usable",
    employerDetailKpiVoicemail: "Voicemail",
    employerDetailConcerning: "Most concerning ghosts",
    employerDetailConcerningEmpty:
      "No ghost outcomes yet in this audit. We'll surface up to three of the most concerning rows here once calls complete.",
    employerDetailNoTranscripts:
      "Per-call transcripts are kept in audit logs and surfaced only on the patient experience.",
    employerDetailMissingTitle: "Audit not found",
    employerDetailMissing:
      "We couldn't find this audit. If it was simulated in another browser, it will not appear here.",

    // ── Employer network health (aggregate view) ───────────────
    employerHealthTitle: "Network health",
    employerHealthRunning: "{n} running",
    employerHealthEmpty:
      "Run a network audit to populate your renewal-ready dashboard. We'll roll up ghost rates, coverage gaps, and a financial-exposure estimate as audits complete.",
    employerHealthGhostByCarrier: "Ghost rate by carrier",
    employerHealthExposureTitle: "Financial exposure (sketch)",
    employerHealthExposureNote:
      "Headcount × 10% baseline behavioral-health prevalence × weighted ghost rate × $4,783/year per untreated case. Order-of-magnitude planning anchor only.",
    employerHealthExposureHeadcount: "Headcount",
    employerHealthExposureSub: "Illustrative annual exposure",
    employerHealthBrokenTitle: "Broken specialty callouts",
    employerHealthBrokenRow: "0 real providers across {n} audit(s) asking for this need.",
    employerHealthGapsTitle: "Coverage gaps by ZIP",
    employerHealthGapsEmpty: "No ZIP-level gaps yet — all audited ZIPs returned at least one real listing.",
    employerHealthGapRow: "{real} real · {ghost} ghost · {audits} audit(s)",

    // ── Renewal negotiation packet page ───────────────────────
    employerRenewalPacketTitle: "Carrier Renewal Negotiation Packet",
    employerRenewalPacketEyebrow: "Renewal negotiation",
    employerRenewalPacketBody:
      "Generate a professional, HR-facing renewal packet from your audit history. Fill in the renewal details below — the packet pulls from your existing audit data automatically.",
    employerRenewalPacketCta: "Generate Renewal Packet (PDF)",
    employerRenewalPacketNoData:
      "Run a batch audit first to populate the packet.",
    employerRenewalFormTitle: "Renewal & Employer Details",
    employerRenewalFormHelp:
      "Used in the packet header, executive summary, contract language, and final position. Placeholders are fine — counsel will redline before submission.",
    employerRenewalFieldEmployer: "Employer name",
    employerRenewalFieldCarrier: "Carrier name",
    employerRenewalFieldPlan: "Plan name or type",
    employerRenewalFieldYear: "Renewal year",
    employerRenewalFieldPeriodStart: "Audit period start",
    employerRenewalFieldPeriodEnd: "Audit period end",
    employerRenewalFieldMarkets: "Employee markets reviewed",
    employerRenewalFieldEmployees: "Covered employees",
    employerRenewalFieldIncrease: "Proposed renewal increase ($)",
    employerRenewalFieldSpend: "Annual plan spend ($, optional)",
    employerRenewalFieldThreshold: "Ghost-rate threshold for contract language (%)",
    employerRenewalFieldGoals: "Renewal goals (optional)",
    employerRenewalPreviewExec: "Preview: Executive Renewal Summary",
    employerRenewalPreviewMetrics: "Preview: Key Audit Metrics",
    employerRenewalPreviewAsks: "Preview: Recommended Carrier Requests",
    employerRenewalPreviewMarkets: "Preview: Evidence Summary by Market",
    employerRenewalPreviewFinancial: "Preview: Financial Impact Estimate",
    employerRenewalPreviewFinal: "Preview: Final Renewal Position",
    employerRenewalPreviewAppendix: "Preview: Provider Evidence Appendix",
    employerRenewalBack: "← Employer workspace",

    // ── Negotiation packet ─────────────────────────────────────
    employerPacketTitle: "Negotiation packet",
    employerPacketBody:
      "Generate a counsel-ready packet from your audit history. Review every artifact with counsel before submission to the carrier.",
    employerPacketMemoCta: "Download findings memo (PDF)",
    employerPacketExecCta: "Download executive summary (PDF)",
    employerPacketCsvCta: "Export evidence (CSV)",
    employerPacketDisabledTitle: "Run an audit first to generate the packet.",
    employerReportContextTitle: "Report context",
    employerReportContextHelp:
      "Used in the memorandum header and signature block. Counsel will redline; placeholders are fine.",
    employerReportContextOrg: "Organization name",
    employerReportContextOrgPlaceholder: "Acme Inc.",
    employerReportContextLead: "Benefits lead",
    employerReportContextLeadPlaceholder: "Jane Doe",
  },
};

type LocaleValue = {
  locale: Locale;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LocaleContext = createContext<LocaleValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = DICT.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replaceAll(`{${k}}`, String(v));
        }
      }
      return s;
    },
    [],
  );
  const value = useMemo<LocaleValue>(() => ({ locale: "en", t }), [t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
