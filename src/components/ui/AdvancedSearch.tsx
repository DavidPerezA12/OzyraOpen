/**
 * AdvancedSearch Component
 *
 * Modal de busqueda avanzada para localizar conversaciones por titulo,
 * contenido, modelo y favoritos.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Filter, MessageSquare, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import type { Chat } from '../../types';
import { useSearch, type SearchResult } from '../../hooks/useSearch';
import { getCurrentLanguage, t } from '../../i18n';

interface AdvancedSearchProps {
  isOpen: boolean;
  onClose: () => void;
  chats?: Chat[];
  favorites?: Set<string>;
  onToggleFavorite?: (chatId: string) => void;
  onSelectChat?: (chatId: string) => void;
  availableModels?: string[];
  isDarkMode?: boolean;
}

const EMPTY_CHATS: Chat[] = [];
const EMPTY_FAVORITES = new Set<string>();
const EMPTY_MODELS: string[] = [];

const formatChatDate = (timestamp: number): string =>
  new Intl.DateTimeFormat(getCurrentLanguage(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));

const getLastActivityTimestamp = (chat: Chat): number => {
  if (chat.messages.length === 0) {
    return chat.createdAt;
  }

  return chat.messages.reduce(
    (latest, message) => Math.max(latest, message.timestamp),
    chat.createdAt
  );
};

const normalizeModelLabel = (modelId: string): string =>
  modelId
    .split('/')
    .pop()
    ?.replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || modelId;

interface SearchFiltersPanelProps {
  model?: string;
  titleOnly: boolean;
  onlyFavorites: boolean;
  availableModels: readonly string[];
  hasFilters: boolean;
  onModelChange: (model?: string) => void;
  onTitleOnlyChange: (enabled?: boolean) => void;
  onFavoritesChange: (enabled?: boolean) => void;
  onClear: () => void;
}

const SearchFiltersPanel: React.FC<SearchFiltersPanelProps> = ({
  model,
  titleOnly,
  onlyFavorites,
  availableModels,
  hasFilters,
  onModelChange,
  onTitleOnlyChange,
  onFavoritesChange,
  onClear,
}) => (
  <div className="border-b border-[var(--border-primary)] px-4 py-3">
    <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
      <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
        <Filter className="h-4 w-4 text-[var(--text-muted)]" />
        <select
          value={model || ''}
          onChange={(event) => onModelChange(event.target.value || undefined)}
          className="min-w-0 flex-1 bg-transparent text-[var(--text-primary)] outline-none"
        >
          <option value="">{t('asAllModels')}</option>
          {availableModels.map((modelId) => (
            <option key={modelId} value={modelId}>
              {normalizeModelLabel(modelId)}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={titleOnly}
          onChange={(event) => onTitleOnlyChange(event.target.checked || undefined)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        {t('asTitleOnly')}
      </label>

      <label className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={onlyFavorites}
          onChange={(event) => onFavoritesChange(event.target.checked || undefined)}
          className="h-4 w-4 accent-[var(--color-primary)]"
        />
        {t('asFavorites')}
      </label>
    </div>

    {hasFilters && (
      <button
        type="button"
        onClick={onClear}
        className="mt-3 text-xs font-medium text-[var(--color-primary)] hover:underline"
      >
        {t('asClearFilters')}
      </button>
    )}
  </div>
);

interface SearchResultsProps {
  results: readonly SearchResult[];
  selectedIndex: number;
  query: string;
  favorites: ReadonlySet<string>;
  isDarkMode: boolean;
  resultRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  onSelectChat: (chatId: string) => void;
  onToggleFavorite?: (chatId: string) => void;
  onSelectedIndexChange: (index: number) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  selectedIndex,
  query,
  favorites,
  isDarkMode,
  resultRefs,
  onSelectChat,
  onToggleFavorite,
  onSelectedIndexChange,
}) => (
  <div className="max-h-[30rem] overflow-y-auto py-3 custom-scrollbar">
    {results.length === 0 ? (
      <div className="px-6 py-12 text-center text-sm text-[var(--text-muted)]">
        <Search className="mx-auto mb-3 h-8 w-8 opacity-60" />
        <p className="font-medium text-[var(--text-secondary)]">{t('sidebarNoResults')}</p>
        <p className="mt-1 text-xs">{t('asEmptyHint')}</p>
      </div>
    ) : (
      <div className="space-y-1 px-2" role="listbox" aria-label={t('sidebarSearchLabel')}>
        {results.map((result, index) => {
          const { chat } = result;
          const isSelected = index === selectedIndex;
          const firstFragment = result.matchedFragments[0]?.fragment;
          const isFavorite = favorites.has(chat.id);

          return (
            <div
              key={chat.id}
              ref={(element) => {
                resultRefs.current[index] = element;
              }}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectChat(chat.id)}
              onMouseEnter={() => onSelectedIndexChange(index)}
              className={`palette-item group ${isSelected ? 'palette-item--selected' : ''}`}
            >
              <MessageSquare className="h-5 w-5 flex-shrink-0 text-[var(--color-primary)]" />

              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleFavorite?.(chat.id);
                    }}
                    className="flex-shrink-0 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--color-primary)]"
                    title={isFavorite ? t('removeFavorite') : t('addFavorite')}
                    aria-label={isFavorite ? t('removeFavorite') : t('addFavorite')}
                    aria-pressed={isFavorite}
                  >
                    <Star
                      className={`h-3.5 w-3.5 flex-shrink-0 ${isFavorite ? 'fill-current text-[var(--color-primary)]' : ''}`}
                    />
                  </button>
                  <span className="truncate font-medium text-[var(--text-primary)]">
                    {chat.title || t('untitledChat')}
                  </span>
                </div>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Calendar className="h-3 w-3 flex-shrink-0" />
                  <span>{formatChatDate(getLastActivityTimestamp(chat))}</span>
                  <span aria-hidden="true">·</span>
                  <span>{t('messagesCount', { count: chat.messages.length })}</span>
                  {chat.model && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{normalizeModelLabel(chat.model)}</span>
                    </>
                  )}
                </div>
                {firstFragment && (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {firstFragment}
                  </p>
                )}
              </div>

              {query.trim() && (
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-black/5 text-gray-600'
                  }`}
                >
                  {result.matchCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
);

type AdvancedSearchDialogProps = Omit<AdvancedSearchProps, 'isOpen'>;

const AdvancedSearchDialog: React.FC<AdvancedSearchDialogProps> = ({
  onClose,
  chats = EMPTY_CHATS,
  favorites = EMPTY_FAVORITES,
  onToggleFavorite,
  onSelectChat,
  availableModels = EMPTY_MODELS,
  isDarkMode = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const {
    results,
    query,
    setQuery,
    filters,
    updateFilter,
    clearFilters,
    totalResults,
    searchHistory,
    addToHistory,
    clearHistory,
  } = useSearch(chats, favorites);

  const sortedChats = useMemo(
    () =>
      [...chats]
        .filter((chat) => {
          if (filters.model && chat.model !== filters.model) {
            return false;
          }

          if (filters.onlyFavorites && !favorites.has(chat.id)) {
            return false;
          }

          return true;
        })
        .sort((a, b) => getLastActivityTimestamp(b) - getLastActivityTimestamp(a))
        .slice(0, 8),
    [chats, favorites, filters.model, filters.onlyFavorites]
  );

  const visibleResults = useMemo(
    () =>
      query.trim()
        ? results
        : sortedChats.map((chat) => ({
            chat,
            relevance: 0,
            matchedFragments: [],
            matchCount: 0,
          })),
    [query, results, sortedChats]
  );

  const hasFilters = Boolean(
    filters.model || filters.onlyFavorites || filters.titleOnly || filters.contentOnly
  );

  const handleSelectChat = useCallback(
    (chatId: string) => {
      if (query.trim()) {
        addToHistory(query.trim());
      }
      onSelectChat?.(chatId);
    },
    [addToHistory, onSelectChat, query]
  );

  const updateSelectedIndex = useCallback((nextIndex: number) => {
    const boundedIndex = Math.max(0, nextIndex);
    setSelectedIndex(boundedIndex);
    const selectedElement = resultRefs.current[boundedIndex];
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (visibleResults.length > 0) {
            updateSelectedIndex(Math.min(selectedIndex + 1, visibleResults.length - 1));
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (visibleResults.length > 0) {
            updateSelectedIndex(selectedIndex - 1);
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (visibleResults[selectedIndex]) {
            handleSelectChat(visibleResults[selectedIndex].chat.id);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    },
    [handleSelectChat, onClose, selectedIndex, updateSelectedIndex, visibleResults]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(focusTimer);
      if (dialog?.open && typeof dialog.close === 'function') {
        dialog.close();
      }
    };
  }, []);

  const changeQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    setSelectedIndex(0);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label={t('asTitle')}
      className="fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[101] flex items-start justify-center px-4 pt-[8vh] pointer-events-none">
        <div className="pointer-events-auto w-full max-w-3xl animate-slide-down">
          <div className="palette-panel overflow-hidden">
            <div className="palette-search-bar">
              <Search className="w-5 h-5 text-[var(--color-primary)]" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => changeQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                aria-label={t('asSearchLabel')}
                placeholder={t('asSearchPlaceholder')}
                className="flex-1 bg-transparent text-base font-medium text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)]"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => changeQuery('')}
                  className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]"
                  aria-label={t('clearSearch')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={`rounded-[var(--radius-sm)] p-1.5 transition-colors ${
                  showFilters || hasFilters
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'text-[var(--text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]'
                }`}
                aria-label={t('asToggleFilters')}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
              <kbd className="palette-kbd">ESC</kbd>
            </div>

            {showFilters && (
              <SearchFiltersPanel
                model={filters.model}
                titleOnly={Boolean(filters.titleOnly)}
                onlyFavorites={Boolean(filters.onlyFavorites)}
                availableModels={availableModels}
                hasFilters={hasFilters}
                onModelChange={(model) => {
                  updateFilter('model', model);
                  setSelectedIndex(0);
                }}
                onTitleOnlyChange={(enabled) => {
                  updateFilter('titleOnly', enabled);
                  setSelectedIndex(0);
                }}
                onFavoritesChange={(enabled) => {
                  updateFilter('onlyFavorites', enabled);
                  setSelectedIndex(0);
                }}
                onClear={() => {
                  clearFilters();
                  setSelectedIndex(0);
                }}
              />
            )}

            <div className="flex items-center justify-between border-b border-[var(--border-primary)] px-4 py-2 text-xs text-[var(--text-muted)]">
              <span>{query.trim() ? `${totalResults} ${t('resultsPlural')}` : t('asRecent')}</span>
              {searchHistory.length > 0 && !query.trim() && (
                <button
                  type="button"
                  onClick={clearHistory}
                  className="font-medium text-[var(--color-primary)] hover:underline"
                >
                  {t('asClearRecent')}
                </button>
              )}
            </div>

            <SearchResults
              results={visibleResults}
              selectedIndex={selectedIndex}
              query={query}
              favorites={favorites}
              isDarkMode={isDarkMode}
              resultRefs={resultRefs}
              onSelectChat={handleSelectChat}
              onToggleFavorite={onToggleFavorite}
              onSelectedIndexChange={updateSelectedIndex}
            />
          </div>
        </div>
      </div>
    </dialog>
  );
};

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ isOpen, ...dialogProps }) =>
  isOpen ? <AdvancedSearchDialog {...dialogProps} /> : null;
