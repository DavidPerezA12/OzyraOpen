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
// GENERATION CONFIGURATION
// ============================================================================

export const GENERATION_CONFIG = {
  /** Temperatura de muestreo para respuestas de chat */
  TEMPERATURE: 0.7,

  /**
   * Tokens reservados para la respuesta visible. En modelos de razonamiento
   * `max_tokens` cubre razonamiento + respuesta, así que el presupuesto de
   * razonamiento se suma encima de este valor.
   */
  OUTPUT_TOKENS: 8192,

  /** Presupuesto de razonamiento por nivel (tokens) */
  REASONING_BUDGET_TOKENS: {
    low: 2048,
    medium: 8192,
    high: 16384,
  },

  /** Mínimo que aceptan los proveedores con presupuesto explícito (Anthropic) */
  MIN_REASONING_BUDGET_TOKENS: 1024,
} as const;

// ============================================================================
// HISTORY WINDOW CONFIGURATION
// ============================================================================

/**
 * Ventana de historial enviada al modelo.
 *
 * El inicio de la ventana solo avanza en saltos de `STEP_MESSAGES`: así el
 * prefijo de la petición (system + historial) se mantiene idéntico entre
 * turnos y los proveedores pueden reutilizar su prompt cache. Una ventana
 * que se desliza un mensaje por turno invalida el cache en cada petición.
 */
export const HISTORY_CONFIG = {
  /** Máximo de mensajes de historial por petición */
  MAX_MESSAGES: 40,

  /** Granularidad con la que avanza el inicio de la ventana */
  STEP_MESSAGES: 10,

  /** Máximo estimado de tokens de historial por petición */
  MAX_TOKENS: 32_000,

  /** Estimación de tokens por imagen adjunta */
  IMAGE_TOKENS: 1_000,

  /** Margen reservado al calcular el hueco disponible en la ventana de contexto */
  CONTEXT_SAFETY_MARGIN_TOKENS: 2_048,

  /** Ventana mínima de historial, aunque el modelo declare un contexto pequeño */
  MIN_TOKENS: 1_024,
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
