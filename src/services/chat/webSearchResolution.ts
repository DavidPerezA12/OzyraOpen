import { buildWebSearchContext, runDirectWebSearch } from '../search/providers';
import type { WebSearchResponse } from '../search/types';
import { t } from '../../i18n';
import { logger } from '../../utils/logger';

export interface ResolvedWebSearch {
  readonly directWebSearch: WebSearchResponse | null;
  readonly shouldUseWebSearchTool: boolean;
  readonly webSearchContext?: string;
  readonly fallbackMessage?: string;
}

const getFallbackMessage = (error: unknown): string => {
  const reason = error instanceof Error ? error.message : t('webSearchProviderError');
  return `${reason} ${t('webSearchFallbackSuffix')}`;
};

export async function resolveWebSearchForMessage(
  userInput: string,
  useWebSearch: boolean
): Promise<ResolvedWebSearch> {
  let directWebSearch: WebSearchResponse | null = null;
  let fallbackMessage: string | undefined;

  if (useWebSearch) {
    try {
      directWebSearch = await runDirectWebSearch(userInput.trim());
      if (directWebSearch && directWebSearch.results.length === 0) {
        logger.info('[App] Búsqueda web directa sin resultados; usando OpenRouter como fallback.');
        directWebSearch = null;
      }
    } catch (searchError) {
      logger.warn('[App] Búsqueda web directa fallida; usando OpenRouter como fallback:', {
        detail: searchError,
      });
      fallbackMessage = getFallbackMessage(searchError);
    }
  }

  return {
    directWebSearch,
    shouldUseWebSearchTool: Boolean(useWebSearch && !directWebSearch),
    webSearchContext: directWebSearch ? buildWebSearchContext(directWebSearch) : undefined,
    fallbackMessage,
  };
}
