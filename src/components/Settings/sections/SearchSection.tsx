import { useEffect, useRef, useState } from 'react';
import { getWebSearchSettings, saveWebSearchSettings } from '../../../services/search/settings';
import type { WebSearchProvider } from '../../../services/search/types';
import { t, type TranslationKey } from '../../../i18n';

const SEARCH_PROVIDERS: Array<{
  id: WebSearchProvider;
  label: string;
  descriptionKey: TranslationKey;
}> = [
  {
    id: 'openrouter',
    label: 'OpenRouter',
    descriptionKey: 'searchProviderOpenRouterDesc',
  },
  {
    id: 'tavily',
    label: 'Tavily',
    descriptionKey: 'searchProviderTavilyDesc',
  },
  {
    id: 'brave',
    label: 'Brave Search',
    descriptionKey: 'searchProviderBraveDesc',
  },
];

const SEARCH_RESULT_COUNTS = [3, 5, 8] as const;
const SEARCH_CONTEXT_OPTIONS = [
  { value: 'low', labelKey: 'searchContextLow' },
  { value: 'medium', labelKey: 'searchContextMedium' },
  { value: 'high', labelKey: 'searchContextHigh' },
] as const;
const TAVILY_DEPTH_OPTIONS = [
  { value: 'basic', labelKey: 'searchDepthBasic' },
  { value: 'advanced', labelKey: 'searchDepthAdvanced' },
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
        <h2 className="cfg-page-title">{t('searchPageTitle')}</h2>
        <p className="cfg-page-desc">{t('searchPageDesc')}</p>
      </div>

      <div className="cfg-section" role="radiogroup" aria-label={t('searchProviderGroup')}>
        <span className="cfg-section-label">{t('searchProviderLabel')}</span>
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
                <span className="cfg-row-hint">{t(provider.descriptionKey)}</span>
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
          <span className="cfg-section-label">{t('searchLocalKeyLabel')}</span>
          <div className="cfg-row">
            <div className="cfg-row-info">
              <label htmlFor="tavily-api-key" className="cfg-row-label">
                {t('tavilyKeyLabel')}
              </label>
              <span className="cfg-row-hint">
                {activeKeyMissing ? t('searchNoKeyFallback') : t('searchStoredLocally')}
              </span>
            </div>
            <input
              id="tavily-api-key"
              type="password"
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
          <span className="cfg-section-label">{t('searchLocalKeyLabel')}</span>
          <div className="cfg-row">
            <div className="cfg-row-info">
              <label htmlFor="brave-api-key" className="cfg-row-label">
                {t('braveKeyLabel')}
              </label>
              <span className="cfg-row-hint">
                {activeKeyMissing ? t('searchNoKeyFallback') : t('searchStoredLocally')}
              </span>
            </div>
            <input
              id="brave-api-key"
              type="password"
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
        <span className="cfg-section-label">{t('searchQualityCost')}</span>
        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span className="cfg-row-label">{t('searchResultsLabel')}</span>
            <span className="cfg-row-hint">{t('searchResultsHint')}</span>
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
            <span className="cfg-row-label">{t('searchContextLabel')}</span>
            <span className="cfg-row-hint">{t('searchContextHint')}</span>
          </div>
          <div className="cfg-segment">
            {SEARCH_CONTEXT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`cfg-segment-btn ${settings.contextSize === option.value ? 'cfg-segment-btn--active' : ''}`}
                onClick={() => setSettings((prev) => ({ ...prev, contextSize: option.value }))}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {settings.provider === 'tavily' && (
          <div className="cfg-row">
            <div className="cfg-row-info">
              <span className="cfg-row-label">{t('searchDepthLabel')}</span>
              <span className="cfg-row-hint">{t('searchDepthHint')}</span>
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
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="cfg-actions">
        {dirty && <span className="cfg-actions-hint">{t('unsavedChanges')}</span>}
        <button type="button" onClick={save} className="cfg-btn cfg-btn--primary" disabled={!dirty}>
          {saveState === 'saved' ? t('searchSaved') : t('searchSave')}
        </button>
      </div>

      <p className="cfg-footnote">
        {settings.provider === 'openrouter'
          ? t('searchFootnoteOpenRouter')
          : t('searchFootnoteKeys')}
      </p>
    </div>
  );
}
