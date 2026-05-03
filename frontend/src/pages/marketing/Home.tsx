import { Link } from "react-router-dom";
import { useLocale } from "../../locale";

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.72 12.5 19.79 19.79 0 0 1 1.65 3.9 2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.08 6.08l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" x2="21" y1="6" y2="6" /><line x1="8" x2="21" y1="12" y2="12" /><line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" /><line x1="3" x2="3.01" y1="12" y2="12" /><line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><line x1="10" x2="8" y1="9" y2="9" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconBuilding() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" />
      <path d="M9 22v-4h6v4" /><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01" />
    </svg>
  );
}

function AuditPreviewWidget() {
  const providers = [
    { s: "ghost",     n: "Dr. Chen, LCSW"  },
    { s: "ghost",     n: "Riverside Psych"  },
    { s: "real",      n: "Dr. Osei, PhD"    },
    { s: "ghost",     n: "Metro Mind Ctr"   },
    { s: "real",      n: "Dr. Park, MD"     },
    { s: "voicemail", n: "Albany Assoc."    },
    { s: "ghost",     n: "Dr. Wu, LPC"      },
    { s: "ghost",     n: "Hillside Health"  },
    { s: "real",      n: "Dr. Reyes, LMFT"  },
  ];
  return (
    <div className="mktg-hero-visual" aria-hidden="true">
      <div className="mktg-hero-visual__header">
        <span className="mktg-hero-visual__live-dot" />
        <span>Live audit · Aetna PPO · 9 listings</span>
        <span className="mktg-hero-visual__badge">In progress</span>
      </div>
      <div className="mktg-hero-visual__grid">
        {providers.map((p, i) => (
          <div key={i} className={`mktg-hero-visual__chip ${p.s}`}>
            <span className="mktg-hero-visual__chip-name">{p.n}</span>
            <span className="mktg-hero-visual__chip-status">
              {p.s === "voicemail" ? "vm" : p.s}
            </span>
          </div>
        ))}
      </div>
      <div className="mktg-hero-visual__footer">
        <span className="mktg-hero-visual__stat ghost">5 ghost</span>
        <span className="mktg-hero-visual__stat real">3 real</span>
        <span className="mktg-hero-visual__stat vm">2 voicemail</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { t } = useLocale();

  return (
    <div className="marketing-page">
      <section className="hero mktg-hero-split">
        <div className="mktg-hero-content">
          <div className="hero__eyebrow">{t("homeEyebrow")}</div>
          <h1 className="hero__title">{t("homeTitle")}</h1>
          <p className="hero__lede">{t("homeLede")}</p>
          <div className="hero__actions">
            <Link to="/signup" className="btn cta">
              {t("homeCtaSignup")}
            </Link>
            <Link to="/login" className="btn secondary">
              {t("homeCtaLogin")}
            </Link>
          </div>
          <p className="hero__sub">{t("homeTrust")}</p>
        </div>
        <AuditPreviewWidget />
      </section>

      <div className="mktg-stat-bar">
        <div className="mktg-stat-item">
          <div className="mktg-stat-item__icon"><IconPhone /></div>
          <div>
            <div className="mktg-stat-item__val">Parallel verification calls</div>
            <div className="mktg-stat-item__lbl">We call multiple listings simultaneously</div>
          </div>
        </div>
        <div className="mktg-stat-sep" />
        <div className="mktg-stat-item">
          <div className="mktg-stat-item__icon"><IconList /></div>
          <div>
            <div className="mktg-stat-item__val">Verified shortlist</div>
            <div className="mktg-stat-item__lbl">Only listings that passed live verification</div>
          </div>
        </div>
        <div className="mktg-stat-sep" />
        <div className="mktg-stat-item">
          <div className="mktg-stat-item__icon"><IconFile /></div>
          <div>
            <div className="mktg-stat-item__val">Ready-to-file complaint</div>
            <div className="mktg-stat-item__lbl">Auto-drafted when ghost rate qualifies</div>
          </div>
        </div>
      </div>

      <section className="section">
        <h2 className="section__title">{t("homeWhoTitle")}</h2>
        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-card__icon feature-card__icon--patient">
              <IconUser />
            </div>
            <div className="feature-card__eyebrow">{t("homePatientEyebrow")}</div>
            <h3 className="feature-card__title">{t("homePatientTitle")}</h3>
            <p className="feature-card__body">{t("homePatientBody")}</p>
            <Link to="/signup?role=patient" className="feature-card__link">
              {t("homePatientCta")} →
            </Link>
          </article>
          <article className="feature-card">
            <div className="feature-card__icon feature-card__icon--employer">
              <IconBuilding />
            </div>
            <div className="feature-card__eyebrow">{t("homeEmployerEyebrow")}</div>
            <h3 className="feature-card__title">{t("homeEmployerTitle")}</h3>
            <p className="feature-card__body">{t("homeEmployerBody")}</p>
            <Link to="/signup?role=employer" className="feature-card__link">
              {t("homeEmployerCta")} →
            </Link>
          </article>
        </div>
      </section>

      <section className="section section--alt">
        <h2 className="section__title">{t("homeWhatTitle")}</h2>
        <div className="mktg-feature-tiles">
          <div className="mktg-feature-tile">
            <div className="mktg-feature-tile__icon"><IconPhone /></div>
            <p>{t("homeWhatBullet1")}</p>
          </div>
          <div className="mktg-feature-tile">
            <div className="mktg-feature-tile__icon"><IconList /></div>
            <p>{t("homeWhatBullet2")}</p>
          </div>
          <div className="mktg-feature-tile">
            <div className="mktg-feature-tile__icon"><IconFile /></div>
            <p>{t("homeWhatBullet3")}</p>
          </div>
        </div>
        <div className="section__cta">
          <Link to="/how-it-works" className="btn secondary">
            {t("homeLearnMore")}
          </Link>
          <Link to="/pricing" className="btn">
            {t("homePricingCta")}
          </Link>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">{t("homeTrustTitle")}</h2>
        <p className="lede" style={{ maxWidth: "62ch" }}>{t("homeTrustBody")}</p>
        <p className="lede" style={{ maxWidth: "62ch" }}>
          {t("homeTrustCrisis")}{" "}
          <a href="tel:988">988</a>
          {" · "}
          <a href="https://988lifeline.org/" rel="noopener noreferrer" target="_blank">
            {t("crisisLinks")}
          </a>
          {" · "}
          <a href="https://nycwell.cityofnewyork.us/" rel="noopener noreferrer" target="_blank">
            {t("crisisNyc")}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
