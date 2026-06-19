/**
 * useSearch Hook
 *
 * Hook personalizado para búsqueda avanzada con filtros múltiples y búsqueda fuzzy.
 * Permite buscar en todos los chats y mensajes con soporte para filtros complejos.
 *
 * @module useSearch
 *
 * @example
 * ```tsx
 * const {
 *   results,
 *   query,
 *   setQuery,
 *   filters,
 *   updateFilter,
 *   clearFilters
 * } = useSearch(chats, favorites);
 *
 * // Buscar
 * setQuery('react hooks');
 *
 * // Aplicar filtros
 * updateFilter('model', 'gpt-4');
 * updateFilter('onlyFavorites', true);
 * ```
 */

import { useState, useMemo, useCallback } from 'react';
import type { Chat } from '@/types';

interface SearchFilters {
  /** Filtrar por modelo específico */
  model?: string;
  /** Filtrar por rango de fechas */
  dateFrom?: Date;
  dateTo?: Date;
  /** Filtrar solo favoritos */
  onlyFavorites?: boolean;
  /** Filtrar por tags */
  tags?: string[];
  /** Mínimo de mensajes en el chat */
  minMessages?: number;
  /** Máximo de mensajes en el chat */
  maxMessages?: number;
  /** Buscar en título solamente */
  titleOnly?: boolean;
  /** Buscar en contenido solamente */
  contentOnly?: boolean;
}

export interface SearchResult {
  /** Chat que coincide con la búsqueda */
  chat: Chat;
  /** Índice de relevancia (0-100) */
  relevance: number;
  /** Fragmentos de texto que coinciden */
  matchedFragments: SearchMatch[];
  /** Número de coincidencias encontradas */
  matchCount: number;
}

interface SearchMatch {
  /** ID del mensaje que contiene la coincidencia */
  messageId: string;
  /** Fragmento de texto con la coincidencia */
  fragment: string;
  /** Índice de inicio de la coincidencia en el fragmento */
  startIndex: number;
  /** Índice de fin de la coincidencia en el fragmento */
  endIndex: number;
}

interface UseSearchReturn {
  /** Resultados de la búsqueda ordenados por relevancia */
  results: SearchResult[];
  /** Query de búsqueda actual */
  query: string;
  /** Actualizar query de búsqueda */
  setQuery: (query: string) => void;
  /** Filtros actuales */
  filters: SearchFilters;
  /** Actualizar un filtro específico */
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  /** Limpiar todos los filtros */
  clearFilters: () => void;
  /** Si hay búsqueda activa */
  hasActiveSearch: boolean;
  /** Si se está buscando */
  isSearching: boolean;
  /** Número total de resultados */
  totalResults: number;
  /** Historial de búsquedas */
  searchHistory: string[];
  /** Añadir al historial */
  addToHistory: (query: string) => void;
  /** Limpiar historial */
  clearHistory: () => void;
}

const SEARCH_HISTORY_KEY = 'ozyrachat_search_history';
const MAX_HISTORY_ITEMS = 10;
/**
 * Hook de búsqueda avanzada
 */
export function useSearch(chats: Chat[], favorites: Set<string> = new Set()): UseSearchReturn {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Función para hacer fuzzy match
  const fuzzyMatch = useCallback((text: string, search: string): boolean => {
    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();

    // Búsqueda exacta
    if (textLower.includes(searchLower)) {
      return true;
    }

    // Búsqueda fuzzy simple
    let searchIndex = 0;
    for (let i = 0; i < textLower.length && searchIndex < searchLower.length; i++) {
      if (textLower[i] === searchLower[searchIndex]) {
        searchIndex++;
      }
    }

    return searchIndex === searchLower.length;
  }, []);

  // Extraer fragmentos con coincidencias
  const extractFragments = useCallback(
    (text: string, searchTerm: string, messageId: string): SearchMatch[] => {
      const matches: SearchMatch[] = [];
      const searchLower = searchTerm.toLowerCase();
      const textLower = text.toLowerCase();

      let startIndex = 0;
      while ((startIndex = textLower.indexOf(searchLower, startIndex)) !== -1) {
        // Extraer fragmento con contexto
        const fragmentStart = Math.max(0, startIndex - 50);
        const fragmentEnd = Math.min(text.length, startIndex + searchLower.length + 50);
        const fragment =
          (fragmentStart > 0 ? '...' : '') +
          text.substring(fragmentStart, fragmentEnd) +
          (fragmentEnd < text.length ? '...' : '');

        matches.push({
          messageId,
          fragment,
          startIndex: fragmentStart > 0 ? startIndex - fragmentStart + 3 : startIndex,
          endIndex:
            fragmentStart > 0
              ? startIndex - fragmentStart + 3 + searchLower.length
              : startIndex + searchLower.length,
        });

        startIndex += searchLower.length;

        // Limitar a 3 fragmentos por mensaje
        if (matches.length >= 3) {
          break;
        }
      }

      return matches;
    },
    []
  );

  // Calcular relevancia
  const calculateRelevance = useCallback(
    (chat: Chat, searchTerm: string, matchCount: number): number => {
      let score = 0;

      // Coincidencia en título vale más
      if (chat.title.toLowerCase().includes(searchTerm.toLowerCase())) {
        score += 40;
      }

      // Más coincidencias = más relevancia
      score += Math.min(matchCount * 5, 30);

      // Chats recientes valen más
      const daysSinceCreation = (Date.now() - chat.createdAt) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7) {
        score += 20;
      } else if (daysSinceCreation < 30) {
        score += 10;
      }

      // Chats con más mensajes valen un poco más
      score += Math.min(chat.messages.length, 10);

      return Math.min(score, 100);
    },
    []
  );

  // Aplicar filtros
  const applyFilters = useCallback(
    (chat: Chat): boolean => {
      // Filtro de modelo
      if (filters.model && chat.model !== filters.model) {
        return false;
      }

      // Filtro de favoritos
      if (filters.onlyFavorites && !favorites.has(chat.id)) {
        return false;
      }

      // Filtro de fecha
      if (filters.dateFrom && chat.createdAt < filters.dateFrom.getTime()) {
        return false;
      }
      if (filters.dateTo && chat.createdAt > filters.dateTo.getTime()) {
        return false;
      }

      // Filtro de número de mensajes
      if (filters.minMessages && chat.messages.length < filters.minMessages) {
        return false;
      }
      if (filters.maxMessages && chat.messages.length > filters.maxMessages) {
        return false;
      }

      return true;
    },
    [filters, favorites]
  );

  // Resultados de búsqueda
  const results = useMemo<SearchResult[]>(() => {
    if (!query.trim()) {
      return [];
    }

    const searchResults: SearchResult[] = [];
    const searchTerm = query.trim();

    for (const chat of chats) {
      // Aplicar filtros primero
      if (!applyFilters(chat)) {
        continue;
      }

      const matchedFragments: SearchMatch[] = [];
      let matchCount = 0;

      // Buscar en título
      if (!filters.contentOnly && fuzzyMatch(chat.title, searchTerm)) {
        matchCount++;
      }

      // Buscar en mensajes
      if (!filters.titleOnly) {
        for (const message of chat.messages) {
          if (fuzzyMatch(message.content, searchTerm)) {
            matchCount++;
            const fragments = extractFragments(message.content, searchTerm, message.id);
            matchedFragments.push(...fragments);
          }
        }
      }

      // Si hay coincidencias, añadir a resultados
      if (matchCount > 0) {
        searchResults.push({
          chat,
          relevance: calculateRelevance(chat, searchTerm, matchCount),
          matchedFragments: matchedFragments.slice(0, 5), // Limitar a 5 fragmentos
          matchCount,
        });
      }
    }

    // Ordenar por relevancia
    return searchResults.sort((a, b) => b.relevance - a.relevance);
  }, [query, chats, filters, fuzzyMatch, extractFragments, calculateRelevance, applyFilters]);

  // Actualizar filtro
  const updateFilter = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  // Limpiar filtros
  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Añadir al historial
  const addToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      return;
    }

    setSearchHistory((prev) => {
      const updated = [searchQuery, ...prev.filter((q) => q !== searchQuery)];
      const trimmed = updated.slice(0, MAX_HISTORY_ITEMS);

      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(trimmed));
      } catch {
        // Ignore storage errors
      }

      return trimmed;
    });
  }, []);

  // Limpiar historial
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // Ignore storage errors
    }
  }, []);

  const hasActiveFilters = Object.keys(filters).length > 0;
  const hasActiveSearch = query.trim().length > 0 || hasActiveFilters;

  return {
    results,
    query,
    setQuery,
    filters,
    updateFilter,
    clearFilters,
    hasActiveSearch,
    isSearching: false, // Could be used for debounced search
    totalResults: results.length,
    searchHistory,
    addToHistory,
    clearHistory,
  };
}
