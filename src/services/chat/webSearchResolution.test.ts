import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSearchResponse } from '../search/types';
import { buildWebSearchContext, runDirectWebSearch } from '../search/providers';
import { resolveWebSearchForMessage } from './webSearchResolution';

vi.mock('../search/providers', () => ({
  buildWebSearchContext: vi.fn(() => 'contexto web'),
  runDirectWebSearch: vi.fn(),
}));

const directSearch: WebSearchResponse = {
  provider: 'tavily',
  query: 'consulta',
  results: [
    {
      title: 'Resultado',
      url: 'https://example.com',
      snippet: 'Texto',
    },
  ],
  annotations: [],
};

describe('resolveWebSearchForMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips direct search when web search is disabled', async () => {
    await expect(resolveWebSearchForMessage('hola', false)).resolves.toEqual({
      directWebSearch: null,
      shouldUseWebSearchTool: false,
      webSearchContext: undefined,
      fallbackMessage: undefined,
    });
    expect(runDirectWebSearch).not.toHaveBeenCalled();
  });

  it('uses direct search context when a provider returns results', async () => {
    vi.mocked(runDirectWebSearch).mockResolvedValue(directSearch);

    await expect(resolveWebSearchForMessage(' consulta ', true)).resolves.toEqual({
      directWebSearch: directSearch,
      shouldUseWebSearchTool: false,
      webSearchContext: 'contexto web',
      fallbackMessage: undefined,
    });
    expect(runDirectWebSearch).toHaveBeenCalledWith('consulta');
    expect(buildWebSearchContext).toHaveBeenCalledWith(directSearch);
  });

  it('falls back to the OpenRouter web search tool for empty results', async () => {
    vi.mocked(runDirectWebSearch).mockResolvedValue({ ...directSearch, results: [] });

    await expect(resolveWebSearchForMessage('consulta', true)).resolves.toMatchObject({
      directWebSearch: null,
      shouldUseWebSearchTool: true,
      fallbackMessage: undefined,
    });
  });

  it('returns a fallback message when direct search fails', async () => {
    vi.mocked(runDirectWebSearch).mockRejectedValue(new Error('Sin clave'));

    await expect(resolveWebSearchForMessage('consulta', true)).resolves.toMatchObject({
      directWebSearch: null,
      shouldUseWebSearchTool: true,
      fallbackMessage: 'Sin clave Se usará OpenRouter para esta respuesta.',
    });
  });
});
