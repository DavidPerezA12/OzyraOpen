import {
  Award,
  Bot,
  Brain,
  Camera,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  Gauge,
  Globe,
  Image as ImageIcon,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Wrench,
  Zap,
  CheckSquare,
  Square,
} from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import {
  availableModels,
  getModelCatalogSnapshot,
  getModelUsageScores,
  mapOpenRouterModelToInfo,
  openRouterModelSupportsTextInTextOut,
  subscribeToModelCatalog,
  uniqueDisplayProviderNames,
  updateAvailableModels,
  type OpenRouterApiModel,
  type ModelCatalogMeta,
} from '../../../config/models';
import { fetchOpenRouterModels } from '../../../services/openrouter/client';
import type { TranslationKey } from '../../../i18n';

type CapabilityFiltersState = {
  readonly fast: boolean;
  readonly vision: boolean;
  readonly reasoning: boolean;
  readonly effortControl: boolean;
  readonly toolCalling: boolean;
  readonly imageGeneration: boolean;
  readonly pdfComprehension: boolean;
};
type CapabilityFilterKey = keyof CapabilityFiltersState;

interface ModelsSectionProps {
  readonly isDarkMode: boolean;
  readonly enabledModelIds: readonly string[];
  readonly toggleModelEnabled: (modelId: string) => void;
  readonly modelSearch: string;
  readonly setModelSearch: (v: string) => void;
  readonly capabilityFilters: CapabilityFiltersState;
  readonly setCapabilityFilters: (v: CapabilityFiltersState) => void;
  readonly selectedProviders: string[];
  readonly setSelectedProviders: (v: string[]) => void;
  readonly t: (key: TranslationKey) => string;
}

const CAP_CONFIG: { key: CapabilityFilterKey; label: string; icon: React.ElementType }[] = [
  { key: 'fast', label: 'Rápido', icon: Zap },
  { key: 'vision', label: 'Visión', icon: Eye },
  { key: 'reasoning', label: 'Razonamiento', icon: Brain },
  { key: 'effortControl', label: 'Esfuerzo', icon: Gauge },
  { key: 'toolCalling', label: 'Herramientas', icon: Wrench },
  { key: 'imageGeneration', label: 'Imágenes', icon: ImageIcon },
  { key: 'pdfComprehension', label: 'PDF', icon: FileText },
];

const TOP_PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'DeepSeek', 'Mistral', 'GLM'];

const fmtCtx = (n?: number) => {
  if (!n) {
    return null;
  }
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  return `${Math.round(n / 1000)}K`;
};

const ModelsSection: React.FC<ModelsSectionProps> = ({
  enabledModelIds,
  toggleModelEnabled,
  modelSearch,
  setModelSearch,
  capabilityFilters,
  setCapabilityFilters,
  selectedProviders,
  setSelectedProviders,
  t,
}) => {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showAllProviders, setShowAllProviders] = React.useState(false);
  const catalogSnapshot = React.useSyncExternalStore(
    subscribeToModelCatalog,
    getModelCatalogSnapshot,
    getModelCatalogSnapshot
  );
  const catalogMeta = React.useMemo(
    () => JSON.parse(catalogSnapshot) as ModelCatalogMeta,
    [catalogSnapshot]
  );

  const handleSync = async () => {
    if (isSyncing) {
      return;
    }
    setIsSyncing(true);
    const tid = toast.loading(t('syncing'));
    try {
      const raw = await fetchOpenRouterModels();
      const mapped = (raw as OpenRouterApiModel[]).flatMap((model) =>
        openRouterModelSupportsTextInTextOut(model) ? [mapOpenRouterModelToInfo(model)] : []
      );
      updateAvailableModels(mapped);
      toast.success(t('syncSuccess'), { id: tid });
    } catch (e) {
      console.error(e);
      toast.error(t('syncError'), { id: tid });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleCap = (key: CapabilityFilterKey) =>
    setCapabilityFilters({ ...capabilityFilters, [key]: !capabilityFilters[key] });

  const clearAll = () => {
    setCapabilityFilters({
      fast: false,
      vision: false,
      reasoning: false,
      effortControl: false,
      toolCalling: false,
      imageGeneration: false,
      pdfComprehension: false,
    });
    setSelectedProviders([]);
  };

  const activeFilters =
    Object.values(capabilityFilters).filter(Boolean).length + selectedProviders.length;
  const enabledModelIdSet = new Set(enabledModelIds);
  const selectedProviderSet = new Set(selectedProviders);
  const modelUsageScores = getModelUsageScores();

  const filtered = availableModels
    .filter((m) => {
      if (selectedProviderSet.size > 0 && !selectedProviderSet.has(m.displayProviderName)) {
        return false;
      }
      if (capabilityFilters.fast && !m.capabilities.fast) {
        return false;
      }
      if (capabilityFilters.vision && !m.capabilities.vision) {
        return false;
      }
      if (capabilityFilters.reasoning && !m.capabilities.reasoning) {
        return false;
      }
      if (capabilityFilters.effortControl && !m.capabilities.effortControl) {
        return false;
      }
      if (capabilityFilters.toolCalling && !m.capabilities.toolCalling) {
        return false;
      }
      if (capabilityFilters.imageGeneration && !m.capabilities.imageGeneration) {
        return false;
      }
      if (capabilityFilters.pdfComprehension && !m.capabilities.pdfComprehension) {
        return false;
      }
      const q = modelSearch.trim().toLowerCase();
      return (
        !q || m.name.toLowerCase().includes(q) || m.displayProviderName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.id === 'ozyra/auto-select') {
        return -1;
      }
      if (b.id === 'ozyra/auto-select') {
        return 1;
      }
      if ((a.isSpecial ?? false) && !(b.isSpecial ?? false)) {
        return -1;
      }
      if (!(a.isSpecial ?? false) && (b.isSpecial ?? false)) {
        return 1;
      }
      if ((a.isNew ?? false) && !(b.isNew ?? false)) {
        return -1;
      }
      if (!(a.isNew ?? false) && (b.isNew ?? false)) {
        return 1;
      }
      const u = (modelUsageScores.get(b.id) ?? 0) - (modelUsageScores.get(a.id) ?? 0);
      return u !== 0 ? u : a.name.localeCompare(b.name);
    });

  const enabledInView = filtered.filter((m) => enabledModelIdSet.has(m.id)).length;
  const selectAll = () =>
    filtered.forEach((m) => {
      if (!enabledModelIdSet.has(m.id)) {
        toggleModelEnabled(m.id);
      }
    });
  const deselectAll = () =>
    filtered.forEach((m) => {
      if (enabledModelIdSet.has(m.id)) {
        toggleModelEnabled(m.id);
      }
    });

  const topP = uniqueDisplayProviderNames.filter((p) => TOP_PROVIDERS.includes(p));
  const otherP = uniqueDisplayProviderNames.filter((p) => !TOP_PROVIDERS.includes(p));

  const providerChip = (p: string) => {
    const on = selectedProviderSet.has(p);
    const model = availableModels.find((m) => m.displayProviderName === p);
    const icon = model?.icon;
    let iconEl: React.ReactNode = <Bot size={11} />;
    if (typeof icon === 'string') {
      iconEl = <img src={icon} alt="" style={{ width: 12, height: 12, objectFit: 'contain' }} />;
    } else if (icon) {
      const IC = icon as React.ElementType;
      iconEl = <IC size={11} />;
    }
    return (
      <button
        type="button"
        key={p}
        onClick={() =>
          setSelectedProviders(
            on ? selectedProviders.filter((x) => x !== p) : [...selectedProviders, p]
          )
        }
        className={`mli-chip ${on ? 'mli-chip--on' : ''}`}
        aria-pressed={on}
      >
        {iconEl}
        {p}
      </button>
    );
  };

  return (
    <div className="mli-root">
      {/* ─ Top bar ─ */}
      <div className="mli-topbar">
        <div>
          <h2 className="cfg-page-title">{t('modelsTitle')}</h2>
          <p className="cfg-page-desc" style={{ marginTop: '0.2rem' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{enabledModelIds.length}</strong>{' '}
            activos · {availableModels.length} disponibles · {uniqueDisplayProviderNames.length}{' '}
            proveedores
            {catalogMeta.source === 'openrouter' && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  marginLeft: '0.5rem',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--text-primary)',
                    display: 'inline-block',
                  }}
                />
                Live
              </span>
            )}
          </p>
        </div>
        <button type="button" onClick={handleSync} disabled={isSyncing} className="mli-sync">
          <RefreshCw
            size={13}
            style={isSyncing ? { animation: 'mli-spin 1s linear infinite' } : undefined}
          />
          {isSyncing ? 'Sincronizando…' : t('syncModels')}
        </button>
      </div>

      {/* ─ Filters ─ */}
      <div className="mli-filters">
        <div className="mli-filter-row">
          <span className="mli-filter-label">
            <SlidersHorizontal size={10} />
            Proveedores
          </span>
          <div className="mli-chips">
            <button
              type="button"
              onClick={() => setSelectedProviders([])}
              className={`mli-chip mli-chip--all ${selectedProviders.length === 0 ? 'mli-chip--on' : ''}`}
              aria-pressed={selectedProviders.length === 0}
            >
              Todos
            </button>
            {topP.map(providerChip)}
            {otherP.length > 0 && (
              <button
                type="button"
                className="mli-chip mli-chip--more"
                onClick={() => setShowAllProviders((v) => !v)}
                aria-expanded={showAllProviders}
              >
                {showAllProviders ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                {showAllProviders ? 'Menos' : `+${otherP.length}`}
              </button>
            )}
          </div>
        </div>
        {showAllProviders && (
          <div className="mli-filter-row" style={{ paddingTop: 0 }}>
            <span className="mli-filter-label" />
            <div className="mli-chips">{otherP.map(providerChip)}</div>
          </div>
        )}
        <div className="mli-filter-row mli-filter-row--sep">
          <span className="mli-filter-label">Capacidades</span>
          <div className="mli-chips">
            {CAP_CONFIG.map(({ key, label, icon: Icon }) => (
              <button
                type="button"
                key={key}
                onClick={() => toggleCap(key)}
                className={`mli-chip mli-chip--cap ${capabilityFilters[key] ? 'mli-chip--on' : ''}`}
                aria-pressed={capabilityFilters[key]}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─ Toolbar ─ */}
      <div className="mli-toolbar">
        <label className="mli-search">
          <Search size={13} />
          <input
            type="text"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            placeholder="Buscar modelos…"
            className="mli-search-input"
            aria-label="Buscar modelos"
          />
        </label>
        <div className="mli-bulk">
          <span className="mli-count">
            <strong>{enabledInView}</strong> / {filtered.length} activos
          </span>
          <button
            type="button"
            onClick={selectAll}
            disabled={enabledInView === filtered.length || filtered.length === 0}
            className="mli-bulk-btn"
          >
            <CheckSquare size={12} /> Activar todos
          </button>
          <button
            type="button"
            onClick={deselectAll}
            disabled={enabledInView === 0}
            className="mli-bulk-btn"
          >
            <Square size={12} /> Quitar todos
          </button>
          {activeFilters > 0 && (
            <button type="button" onClick={clearAll} className="mli-bulk-btn mli-bulk-btn--clear">
              ✕ Limpiar ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* ─ Model list ─ */}
      <div className="mli-list">
        {filtered.map((model) => {
          const on = enabledModelIdSet.has(model.id);
          const icon = model.icon || Bot;
          const iconEl =
            typeof icon === 'string' ? (
              <img
                src={icon}
                alt=""
                style={{ width: 18, height: 18, objectFit: 'contain' }}
                loading="lazy"
              />
            ) : (
              (() => {
                const IC = icon as React.ElementType;
                return <IC size={18} style={{ color: 'var(--text-muted)' }} />;
              })()
            );

          const ctx = fmtCtx(model.contextLength);

          return (
            <div key={model.id} className={`mli-item ${on ? 'mli-item--on' : ''}`}>
              {/* Left: icon + text */}
              <div className="mli-item-left">
                <div className="mli-item-icon">{iconEl}</div>
                <div className="mli-item-body">
                  {/* Name row */}
                  <div className="mli-item-name-row">
                    <span className="mli-item-name">{model.name}</span>
                    <span className="mli-item-provider">{model.displayProviderName}</span>
                    {model.isNew && <span className="mli-badge mli-badge--new">Nuevo</span>}
                    {model.isRecommended && (
                      <span className="mli-badge mli-badge--rec">
                        <Award size={9} />
                        Rec.
                      </span>
                    )}
                    {(model.tier ?? 'standard') === 'premium' && (
                      <span className="mli-badge mli-badge--advanced">
                        <Sparkles size={9} />
                        Avanzado
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {model.description && <p className="mli-item-desc">{model.description}</p>}

                  {/* Stats + capabilities */}
                  <div className="mli-item-footer">
                    <div className="mli-item-stats">
                      {ctx && <span className="mli-stat">{ctx} ctx</span>}
                      {model.pricing ? (
                        model.pricing.input === 0 && model.pricing.output === 0 ? (
                          <span className="mli-stat mli-stat--free">Sin coste</span>
                        ) : (
                          <span className="mli-stat">
                            ${model.pricing.input.toFixed(2)} / ${model.pricing.output.toFixed(2)}{' '}
                            por 1M
                          </span>
                        )
                      ) : (
                        <span className="mli-stat">Precio no disponible</span>
                      )}
                    </div>
                    <div className="mli-item-caps">
                      {model.capabilities.reasoning && (
                        <span className="mli-cap">
                          <Brain size={9} />
                          Razonamiento
                        </span>
                      )}
                      {model.capabilities.vision && (
                        <span className="mli-cap">
                          <Eye size={9} />
                          Visión
                        </span>
                      )}
                      {model.capabilities.fast && (
                        <span className="mli-cap">
                          <Zap size={9} />
                          Rápido
                        </span>
                      )}
                      {model.capabilities.toolCalling && (
                        <span className="mli-cap">
                          <Wrench size={9} />
                          Tools
                        </span>
                      )}
                      {model.capabilities.images && (
                        <span className="mli-cap">
                          <Camera size={9} />
                          Imgs
                        </span>
                      )}
                      {model.capabilities.webSearch && (
                        <span className="mli-cap">
                          <Globe size={9} />
                          Web
                        </span>
                      )}
                      {model.capabilities.files && (
                        <span className="mli-cap">
                          <FileText size={9} />
                          Archivos
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: toggle */}
              <label
                className="mli-toggle"
                aria-label={on ? 'Desactivar modelo' : 'Activar modelo'}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggleModelEnabled(model.id)}
                  className="sr-only"
                />
                <span
                  className={`mli-toggle-track ${on ? 'mli-toggle-track--on' : ''}`}
                  aria-hidden
                >
                  <span className="mli-toggle-knob" />
                </span>
              </label>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="mli-empty">Ningún modelo coincide con los filtros actuales.</div>
        )}
      </div>
    </div>
  );
};

export default ModelsSection;
