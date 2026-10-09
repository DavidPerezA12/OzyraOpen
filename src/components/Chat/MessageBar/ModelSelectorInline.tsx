import { Bot, Check, ChevronDown, Search, Settings, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getModelInfo, useModelCatalog } from '../../../models/catalog';
import { useModelUsageScores } from '../../../models/usage';
import type { ModelInfo } from '../../../types';
import { t } from '../../../i18n';

import type { ModelPickerProps } from './types';

const modelMatchesQuery = (model: ModelInfo, query: string) =>
  model.name.toLowerCase().includes(query) ||
  model.displayProviderName.toLowerCase().includes(query);

export const ModelSelectorInline = ({
  selectedModel,
  enabledModelIds,
  onSelectModel,
  onOpenSettings,
}: ModelPickerProps) => {
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const { models } = useModelCatalog();
  const selectedModelInfo = getModelInfo(selectedModel);
  const modelSearchInputRef = useRef<HTMLInputElement>(null);
  const modelUsageScores = useModelUsageScores();
  const enabledModels = useMemo(() => {
    const enabledIds = new Set(enabledModelIds);
    return models.filter((model) => enabledIds.has(model.id));
  }, [enabledModelIds, models]);
  const enabledModelsCount = enabledModels.length;
  const filteredModels = useMemo(() => {
    const query = modelSearchQuery.trim().toLowerCase();
    return enabledModels
      .filter((model) => !query || modelMatchesQuery(model, query))
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
        if ((a.isRecommended ?? false) !== (b.isRecommended ?? false)) {
          return a.isRecommended ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }, [enabledModels, modelSearchQuery, modelUsageScores, selectedModel]);

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
    onSelectModel(modelId);
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

    const SelectedIcon = selectedModelInfo.icon;
    return (
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0">
          <SelectedIcon size={14} className="opacity-80" />
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
        aria-haspopup="menu"
        aria-expanded={isModelDropdownOpen}
        aria-controls="model-selector-menu"
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
          id="model-selector-menu"
          className="composer-dropdown-menu focus:outline-none"
          role="menu"
          aria-orientation="vertical"
          aria-label={t('modelsDropdownTitle')}
        >
          <div className="p-2 flex-shrink-0 border-b border-[var(--border-primary)] relative z-10 bg-[var(--bg-elevated)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-[var(--text-primary)]">
                {t('modelsDropdownTitle')}
              </p>
              <div className="px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                {enabledModelsCount}
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3 h-3 text-[var(--text-secondary)]" />
              <input
                type="text"
                aria-label={t('searchModels')}
                placeholder={t('search')}
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
                  aria-label={t('clearSearch')}
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
                {t('noModelsFound')}
              </div>
            ) : (
              filteredModels.map((model) => {
                const ModelIcon = model.icon;
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
                    role="menuitemradio"
                    aria-checked={isSelected}
                  >
                    <div
                      className={`flex-shrink-0 p-2 rounded-[var(--radius-sm)] border border-[var(--border-primary)] transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)]/15 border-[var(--color-primary)]/30'
                          : 'bg-[var(--bg-secondary)]'
                      }`}
                    >
                      <ModelIcon
                        size={16}
                        className={
                          isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--text-primary)]'
                        }
                      />
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
                onOpenSettings();
                setIsModelDropdownOpen(false);
              }}
              className="atelier-btn-secondary w-full justify-center text-xs"
            >
              <Settings className="w-3 h-3" />
              <span>{t('configureAction')}</span>
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
