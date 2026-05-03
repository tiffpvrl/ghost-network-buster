/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_DEMO_API_KEY?: string;
  /** Set to "false" to hide Employer in the nav (default: shown). */
  readonly VITE_SHOW_EMPLOYER?: string;
  /** Optional human-readable duration hint on the landing page. */
  readonly VITE_AUDIT_DURATION_HINT?: string;
  /**
   * Seconds per provider used with preview count for landing ETA
   * (`Math.max(60, round(previewCount * factor))`).
   */
  readonly VITE_AUDIT_SECONDS_PER_CALL?: string;
  /** If set, Terms link opens this URL instead of the in-app /terms route. */
  readonly VITE_TERMS_URL?: string;
  /** If set, Privacy link opens this URL instead of the in-app /privacy route. */
  readonly VITE_PRIVACY_URL?: string;
  /** If set to "true", show completion confetti for non-demo audits (demo always eligible). */
  readonly VITE_CELEBRATE_COMPLETION?: string;
  /** Display-only price for one audit credit (USD), shown on Pricing and Checkout. */
  readonly VITE_PRICE_PER_AUDIT_USD?: string;
  /** Banner label shown on the demo checkout page. */
  readonly VITE_DEMO_CHECKOUT_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
