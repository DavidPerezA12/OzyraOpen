/**
 * Application Constants
 *
 * Definiciones centralizadas de constantes para evitar "magic numbers"
 * y strings hardcodeados en toda la aplicación.
 *
 * @module Constants
 * @example
 * ```tsx
 * import { CHAT_CONFIG } from '../config/constants';
 *
 * // Usar constantes
 * if (pinnedChats.length >= CHAT_CONFIG.MAX_PINNED_CHATS) {
 *   toast.error('Máximo de chats fijados alcanzado');
 * }
 * ```
 */

// ============================================================================
// CHAT CONFIGURATION
// ============================================================================

export const CHAT_CONFIG = {
  /** Número máximo de chats que se pueden fijar */
  MAX_PINNED_CHATS: 4,
} as const;

// ============================================================================
// API CONFIGURATION
// ============================================================================

export const API_CONFIG = {
  /** Timeout para requests de API (ms) */
  REQUEST_TIMEOUT: 30000,

  /** Número máximo de reintentos para requests fallidos */
  MAX_RETRIES: 3,

  /** Delay base para backoff exponencial (ms) */
  RETRY_DELAY: 1000,
} as const;

// ============================================================================
// LOCAL STORAGE KEYS
// ============================================================================

export const STORAGE_KEYS = {
  /** Key para OpenRouter API key guardada localmente */
  OPENROUTER_API_KEY: 'ozyra_openrouter_api_key',

  /** Key para proveedor de búsqueda web */
  WEB_SEARCH_PROVIDER: 'ozyra_web_search_provider',

  /** Key para Tavily API key guardada localmente */
  TAVILY_API_KEY: 'ozyra_tavily_api_key',

  /** Key para Brave Search API key guardada localmente */
  BRAVE_SEARCH_API_KEY: 'ozyra_brave_search_api_key',

  /** Key para número máximo de resultados de búsqueda web */
  WEB_SEARCH_MAX_RESULTS: 'ozyra_web_search_max_results',

  /** Key para profundidad de búsqueda Tavily */
  WEB_SEARCH_TAVILY_DEPTH: 'ozyra_web_search_tavily_depth',

  /** Key para tamaño de contexto de búsqueda web */
  WEB_SEARCH_CONTEXT_SIZE: 'ozyra_web_search_context_size',
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: 'Error de conexión',
  TIMEOUT_ERROR: 'Tiempo de espera agotado',

  // Generic
  UNKNOWN_ERROR: 'Ha ocurrido un error inesperado',
} as const;
