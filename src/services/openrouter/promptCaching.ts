import type { ChatCompletionRequest } from './types';

/**
 * Prompt caching en OpenRouter
 * (https://openrouter.ai/docs/guides/best-practices/prompt-caching):
 *
 * - OpenAI, DeepSeek, Gemini 2.5+, Grok, Moonshot, Groq y Z.AI cachean de
 *   forma implícita: basta con que el prefijo de la petición sea idéntico
 *   entre turnos (ver `selectHistoryWindow`).
 * - Anthropic necesita `cache_control` explícito. Con el campo en la raíz,
 *   OpenRouter coloca el breakpoint en el último bloque cacheable y lo va
 *   moviendo a medida que crece la conversación. Por debajo del mínimo de
 *   tokens del modelo no se cachea ni se cobra escritura.
 * - `session_id` fija el proveedor (sticky routing) desde la primera
 *   petición, de modo que los turnos siguientes caen en el mismo cache.
 */
const AUTOMATIC_CACHE_CONTROL_MODEL = /^~?anthropic\//;

const MAX_SESSION_ID_LENGTH = 256;

export const supportsAutomaticCacheControl = (apiModelId: string): boolean =>
  AUTOMATIC_CACHE_CONTROL_MODEL.test(apiModelId);

export const getPromptCachingParams = ({
  apiModelId,
  sessionId,
}: {
  readonly apiModelId: string;
  readonly sessionId?: string;
}): Pick<ChatCompletionRequest, 'cache_control' | 'session_id'> => ({
  ...(supportsAutomaticCacheControl(apiModelId)
    ? { cache_control: { type: 'ephemeral' as const } }
    : {}),
  ...(sessionId ? { session_id: sessionId.slice(0, MAX_SESSION_ID_LENGTH) } : {}),
});
