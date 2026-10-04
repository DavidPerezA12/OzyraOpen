import { t } from '../../../i18n';
const getSiteUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_SITE_URL?.trim();
  if (configuredUrl) {
    return configuredUrl;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'https://github.com/DavidPerezA12/OzyraOpen';
};

const getSiteLabel = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return t('aboutOpenSite');
  }
};

export default function AboutSection() {
  const siteUrl = getSiteUrl();
  const siteLabel = getSiteLabel(siteUrl);

  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">{t('navAbout')}</h2>
        <p className="cfg-page-desc">{t('aboutDesc')}</p>
      </div>

      <div className="cfg-section">
        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('aboutVersion')}</span>
          </div>
          <span className="cfg-row-value">1.0.0</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('aboutStorage')}</span>
            <span className="cfg-row-hint">{t('aboutStorageHint')}</span>
          </div>
          <span className="cfg-badge cfg-badge--accent">{t('aboutLocalBadge')}</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('aboutInfra')}</span>
          </div>
          <span className="cfg-badge cfg-badge--neutral">{t('aboutInfraBadge')}</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('aboutAi')}</span>
            <span className="cfg-row-hint">{t('aboutAiHint')}</span>
          </div>
          <span className="cfg-row-value">OpenRouter</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">Stack</span>
          </div>
          <span className="cfg-row-value">Vite · React 18 · TypeScript</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('aboutDomain')}</span>
            <span className="cfg-row-hint">{t('aboutDomainHint')}</span>
          </div>
          <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="cfg-link">
            {siteLabel}
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        </div>

        <div className="cfg-row">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('aboutRepo')}</span>
            <span className="cfg-row-hint">{t('aboutRepoHint')}</span>
          </div>
          <a
            href="https://github.com/DavidPerezA12/OzyraOpen"
            target="_blank"
            rel="noopener noreferrer"
            className="cfg-link"
          >
            GitHub
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M7 17L17 7M17 7H7M17 7v10" />
            </svg>
          </a>
        </div>
      </div>

      <p className="cfg-footnote">
        Tus datos son exclusivamente tuyos. Ozyra Open no incluye telemetría ni tracking.
      </p>
    </div>
  );
}
