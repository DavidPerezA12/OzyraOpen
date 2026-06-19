import { useEffect, useRef, useState } from 'react';
import { getWebSearchSettings, saveWebSearchSettings } from '../../../services/search/settings';
import type { WebSearchProvider } from '../../../services/search/types';

const SEARCH_PROVIDERS: Array<{
  id: WebSearchProvider;
  label: string;
  description: string;
}> = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    description: 'Sin clave adicional. El modelo decide cuándo buscar usando la server tool.',
  },
  {
    id: 'tavily',
    label: 'Tavily',
    description: 'Búsqueda optimizada para agentes y respuestas con contexto breve.',
  },
  {
    id: 'brave',
    label: 'Brave Search',
    description: 'Resultados web directos desde el índice de Brave.',
  },
];

const SEARCH_RESULT_COUNTS = [3, 5, 8] as const;
const SEARCH_CONTEXT_OPTIONS = [
  { value: 'low', label: 'Breve' },
  { value: 'medium', label: 'Medio' },
  { value: 'high', label: 'Amplio' },
] as const;
const TAVILY_DEPTH_OPTIONS = [
  { value: 'basic', label: 'Básica' },
  { value: 'advanced', label: 'Avanzada' },
] as const;

export default function SearchSection() {
  const [settings, setSettings] = useState(() => getWebSearchSettings());
  const [savedSettings, setSavedSettings] = useState(settings);
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
  const saveTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const activeKeyMissing =
    (settings.provider === 'tavily' && !settings.tavilyApiKey.trim()) ||
    (settings.provider === 'brave' && !settings.braveApiKey.trim());

  const save = () => {
    saveWebSearchSettings(settings);
    setSavedSettings(settings);
    setSaveState('saved');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaveState('idle');
      saveTimerRef.current = null;
    }, 1600);
  };

  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">Búsqueda web</h2>
        <p className="cfg-page-desc">
          Elige cómo obtiene contexto de internet el botón de búsqueda del compositor.
        </p>
      </div>

      <div className="cfg-section" role="radiogroup" aria-label="Proveedor de búsqueda">
        <span className="cfg-section-label">Proveedor</span>
        {SEARCH_PROVIDERS.map((provider, index) => {
          const selected = settings.provider === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSettings((prev) => ({ ...prev, provider: provider.id }))}
              className={`cfg-row cfg-row--button ${index < SEARCH_PROVIDERS.length - 1 ? 'cfg-row--border' : ''}`}
            >
              <span className="cfg-row-info">
                <span className="cfg-row-label">{provider.label}</span>
                <span className="cfg-row-hint">{provider.description}</span>
              </span>
              <span className={`cfg-radio ${selected ? 'cfg-radio--on' : ''}`}>
                <span className="cfg-radio__dot" />
              </span>
            </button>
          );
        })}
      </div>

      {settings.provider === 'tavily' && (
        <div className="cfg-section">
          <span className="cfg-section-label">Clave local</span>
          <div className="cfg-row">
            <div className="cfg-row-info">
              <span className="cfg-row-label">Tavily API key</span>
              <span className="cfg-row-hint">
                {activeKeyMissing
                  ? 'Sin clave: las búsquedas usarán OpenRouter como respaldo.'
                  : 'Se guarda en localStorage de este navegador.'}
              </span>
            </div>
            <input
              type="password"
              aria-label="Tavily API key"
              className="cfg-input cfg-input--key"
              value={settings.tavilyApiKey}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, tavilyApiKey: event.target.value }))
              }
              placeholder="tvly-..."
              autoComplete="off"
            />
          </div>
        </div>
      )}

      {settings.provider === 'brave' && (
        <div className="cfg-section">
          <span className="cfg-section-label">Clave local</span>
          <div className="cfg-row">
            <div className="cfg-row-info">
              <span className="cfg-row-label">Brave Search API key</span>
              <span className="cfg-row-hint">
                {activeKeyMissing
                  ? 'Sin clave: las búsquedas usarán OpenRouter como respaldo.'
                  : 'Se guarda en localStorage de este navegador.'}
              </span>
            </div>
            <input
              type="password"
              aria-label="Brave Search API key"
              className="cfg-input cfg-input--key"
              value={settings.braveApiKey}
              onChange={(event) =>
                setSettings((prev) => ({ ...prev, braveApiKey: event.target.value }))
              }
              placeholder="BSA..."
              autoComplete="off"
            />
          </div>
        </div>
      )}

      <div className="cfg-section">
        <span className="cfg-section-label">Calidad y coste</span>
        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">Resultados</span>
            <span className="cfg-row-hint">
              Más resultados dan más cobertura y consumen más contexto.
            </span>
          </div>
          <div className="cfg-segment">
            {SEARCH_RESULT_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className={`cfg-segment-btn ${settings.maxResults === count ? 'cfg-segment-btn--active' : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, maxResults: count }))}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <div className={`cfg-row ${settings.provider === 'tavily' ? 'cfg-row--border' : ''}`}>
          <div className="cfg-row-info">
            <span className="cfg-row-label">Contexto</span>
            <span className="cfg-row-hint">
              Controla cuánto texto de cada resultado se entrega al modelo.
            </span>
          </div>
          <div className="cfg-segment">
            {SEARCH_CONTEXT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`cfg-segment-btn ${settings.contextSize === option.value ? 'cfg-segment-btn--active' : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, contextSize: option.value }))}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {settings.provider === 'tavily' && (
          <div className="cfg-row">
            <div className="cfg-row-info">
              <span className="cfg-row-label">Profundidad Tavily</span>
              <span className="cfg-row-hint">
                La búsqueda avanzada puede mejorar cobertura, con más coste.
              </span>
            </div>
            <div className="cfg-segment">
              {TAVILY_DEPTH_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`cfg-segment-btn ${settings.tavilySearchDepth === option.value ? 'cfg-segment-btn--active' : ''}`}
                  onClick={() =>
                    setSettings((prev) => ({ ...prev, tavilySearchDepth: option.value }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="cfg-actions">
        {dirty && <span className="cfg-actions-hint">Cambios sin guardar</span>}
        <button type="button" onClick={save} className="cfg-btn cfg-btn--primary" disabled={!dirty}>
          {saveState === 'saved' ? 'Guardado' : 'Guardar búsqueda'}
        </button>
      </div>

      <p className="cfg-footnote">
        {settings.provider === 'openrouter'
          ? 'OpenRouter decide cuándo buscar y no necesita una clave adicional. Resultados y contexto se envían como parámetros de su server tool.'
          : 'Estas claves viven en tu navegador y son visibles para quien tenga acceso a esta sesión. Para uso público conviene mover estos proveedores a un proxy propio. Si Tavily o Brave fallan, Ozyra usará OpenRouter como respaldo para esa respuesta.'}
      </p>
    </div>
  );
}
