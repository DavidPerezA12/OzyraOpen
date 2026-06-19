import { buildWebSearchContext, runDirectWebSearch } from '../search/providers';
import type { WebSearchResponse } from '../search/types';

export interface ResolvedWebSearch {
  readonly directWebSearch: WebSearchResponse | null;
  readonly shouldUseWebSearchTool: boolean;
  readonly webSearchContext?: string;
  readonly fallbackMessage?: string;
}

const getFallbackMessage = (error: unknown): string =>
  error instanceof Error
    ? `${error.message} Se usará OpenRouter para esta respuesta.`
    : 'No se pudo usar el proveedor de búsqueda. Se usará OpenRouter para esta respuesta.';

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
        console.info('[App] Búsqueda web directa sin resultados; usando OpenRouter como fallback.');
        directWebSearch = null;
      }
    } catch (searchError) {
      console.warn(
        '[App] Búsqueda web directa fallida; usando OpenRouter como fallback:',
        searchError
      );
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
