import { Bot, Check, ChevronDown, Search, Settings, X, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { availableModels, getModelInfo, getModelUsageScores } from '../../../config/models';

interface ModelSelectorInlineProps {
  readonly selectedModel: string;
  readonly isModelDropdownOpen: boolean;
  readonly setIsModelDropdownOpen: (isOpen: boolean) => void;
  readonly modelDropdownRef: RefObject<HTMLDivElement>;
  readonly modelSearchQuery: string;
  readonly setModelSearchQuery: (query: string) => void;
  readonly enabledModelIds: readonly string[];
  readonly handleModelSelect: (modelId: string) => void;
  readonly setShowSettings: (show: boolean) => void;
}

const modelMatchesQuery = (
  model: (typeof availableModels)[number],
  enabledModelIds: readonly string[],
  modelSearchQuery: string
) =>
  enabledModelIds.includes(model.id) &&
  (model.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) ||
    model.displayProviderName.toLowerCase().includes(modelSearchQuery.toLowerCase()));

export const ModelSelectorInline = ({
  selectedModel,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  modelDropdownRef,
  modelSearchQuery,
  setModelSearchQuery,
  enabledModelIds,
  handleModelSelect,
  setShowSettings,
}: ModelSelectorInlineProps) => {
  const selectedModelInfo = getModelInfo(selectedModel);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);
  const modelUsageScores = getModelUsageScores();
  const enabledModelsCount = availableModels.filter((m) => enabledModelIds.includes(m.id)).length;
  const filteredModels = useMemo(
    () =>
      availableModels
        .filter((m) => modelMatchesQuery(m, enabledModelIds, modelSearchQuery))
        .sort((a, b) => {
          if (a.id === selectedModel) {
            return -1;
          }
          if (b.id === selectedModel) {
            return 1;
          }
          const usageDelta = (modelUsageScores.get(b.id) ?? 0) - (modelUsageScores.get(a.id) ?? 0);
          if (usageDelta !== 0) {
            return usageDelta;
          }
          if ((a.isRecommended ?? false) && !(b.isRecommended ?? false)) {
            return -1;
          }
          if (!(a.isRecommended ?? false) && (b.isRecommended ?? false)) {
            return 1;
          }
          return a.name.localeCompare(b.name);
        }),
    [enabledModelIds, modelSearchQuery, modelUsageScores, selectedModel]
  );

  useEffect(() => {
    if (!isModelDropdownOpen) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      modelSearchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(focusTimer);
  }, [isModelDropdownOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target as Node)) {
        setIsModelDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelDropdownRef, setIsModelDropdownOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModelDropdownOpen) {
        e.preventDefault();
        setIsModelDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModelDropdownOpen, setIsModelDropdownOpen]);

  const selectModel = (modelId: string) => {
    handleModelSelect(modelId);
    setIsModelDropdownOpen(false);
    setModelSearchQuery('');
  };

  const selectedModelLabel = (() => {
    if (!selectedModelInfo) {
      return (
        <div className="flex items-center gap-2">
          <Bot size={14} className="opacity-80" />
          <span className="font-medium">{selectedModel}</span>
        </div>
      );
    }

    if (selectedModel === 'ozyra/auto-select') {
      return (
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0">
            <Zap size={14} className="opacity-80" />
          </div>
          <span className="font-medium">Ozyra</span>
        </div>
      );
    }

    const icon = selectedModelInfo.icon || Bot;
    const IconComponent = typeof icon === 'string' ? null : icon;

    return (
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          {typeof icon === 'string' ? (
            <img
              src={icon}
              alt={`${selectedModelInfo.displayProviderName} logo`}
              className="model-provider-logo h-3.5 w-3.5 object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : IconComponent ? (
            <IconComponent size={14} className="opacity-80" />
          ) : null}
        </div>
        <span className="font-medium">{selectedModelInfo.name}</span>
      </div>
    );
  })();

  return (
    <div className="relative inline-block text-left" ref={modelDropdownRef}>
      <button
        type="button"
        onMouseDown={(e) => {
          e.stopPropagation();
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsModelDropdownOpen(!isModelDropdownOpen);
        }}
        className="composer-tool-btn"
        aria-haspopup="true"
        aria-expanded={isModelDropdownOpen}
      >
        <div className="flex items-center gap-2">
          {selectedModelLabel}
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${isModelDropdownOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isModelDropdownOpen && (
        <div
          className="composer-dropdown-menu focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="options-menu"
        >
          <div className="p-2 flex-shrink-0 border-b border-[var(--border-primary)] relative z-10 bg-[var(--bg-elevated)]">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-medium text-[var(--text-primary)]">Modelos</h3>
              <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                {enabledModelsCount}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)]" />
              <input
                type="text"
                aria-label="Buscar modelos"
                placeholder="Buscar..."
                value={modelSearchQuery}
                onChange={(e) => setModelSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const first = filteredModels[0];
                    if (first) {
                      selectModel(first.id);
                    }
                  }
                }}
                ref={modelSearchInputRef}
                className="atelier-input w-full pl-8 pr-5 py-1.5 text-xs"
              />
              {modelSearchQuery && (
                <button
                  type="button"
                  onClick={() => setModelSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto py-0 custom-scrollbar relative z-1"
            role="none"
          >
            {filteredModels.length === 0 ? (
              <div className="px-3 py-4 text-xs text-[var(--text-muted)] text-center">
                No se encontraron modelos
              </div>
            ) : (
              filteredModels.map((model) => {
                const modelIcon = model.icon || Bot;
                const ModelIconComponent = typeof modelIcon === 'string' ? null : modelIcon;
                const isSelected = selectedModel === model.id;

                return (
                  <button
                    key={model.id}
                    type="button"
                    onClick={() => selectModel(model.id)}
                    className={`group flex items-center gap-3 w-full text-left p-2.5 mx-0 mb-0 border-b border-[var(--border-primary)] last:border-b-0 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--color-primary-soft)] text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]'
                    }`}
                    role="menuitem"
                  >
                    <div
                      className={`flex-shrink-0 p-2 rounded-[var(--radius-sm)] border border-[var(--border-primary)] transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30'
                          : 'bg-[var(--bg-secondary)]'
                      }`}
                    >
                      {typeof modelIcon === 'string' ? (
                        <img
                          src={modelIcon}
                          alt={`${model.displayProviderName} logo`}
                          className="model-provider-logo h-4 w-4 object-contain transition-all duration-150"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : ModelIconComponent ? (
                        <ModelIconComponent
                          size={16}
                          className={
                            isSelected
                              ? 'text-[var(--color-primary)]'
                              : 'text-[var(--text-primary)]'
                          }
                        />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-medium text-xs truncate">{model.name}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] ${isSelected ? 'text-[var(--text-secondary)] opacity-85' : 'text-[var(--text-muted)]'}`}
                        >
                          {model.displayProviderName}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="flex-shrink-0">
                        <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="p-2.5 flex-shrink-0 border-t border-[var(--border-primary)] relative z-10 bg-[var(--bg-elevated)]">
            <button
              type="button"
              onClick={() => {
                setShowSettings(true);
                setIsModelDropdownOpen(false);
              }}
              className="atelier-btn-secondary w-full justify-center text-xs"
            >
              <Settings className="w-3 h-3" />
              <span>Configurar</span>
              <div className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                {enabledModelsCount}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
