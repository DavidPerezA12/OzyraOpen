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
    return 'Abrir sitio';
  }
};

export default function AboutSection() {
  const siteUrl = getSiteUrl();
  const siteLabel = getSiteLabel(siteUrl);

  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">Proyecto</h2>
        <p className="cfg-page-desc">
          Ozyra Open es un cliente de IA local. Tus datos permanecen en este navegador.
        </p>
      </div>

      <div className="cfg-section">
        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">Versión</span>
          </div>
          <span className="cfg-row-value">1.0.0</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">Almacenamiento</span>
            <span className="cfg-row-hint">Datos guardados en localStorage de este navegador.</span>
          </div>
          <span className="cfg-badge cfg-badge--accent">Local</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">Infraestructura propia</span>
          </div>
          <span className="cfg-badge cfg-badge--neutral">No configurada</span>
        </div>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">IA</span>
            <span className="cfg-row-hint">
              Peticiones directas a OpenRouter desde el navegador.
            </span>
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
            <span className="cfg-row-label">Dominio</span>
            <span className="cfg-row-hint">Página pública de Ozyra Open.</span>
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
            <span className="cfg-row-label">Repositorio</span>
            <span className="cfg-row-hint">Código fuente, issues y contribuciones.</span>
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
