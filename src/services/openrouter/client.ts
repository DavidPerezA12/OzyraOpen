import { API_CONFIG, ERROR_MESSAGES, STORAGE_KEYS } from '../../config/constants';
import type { OpenRouterConfig } from './types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  return Math.min(API_CONFIG.RETRY_DELAY * Math.pow(2, attempt), 10000);
}

function isRetryableError(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

function withRequestTimeout(options: RequestInit): RequestInit {
  if (typeof AbortSignal.timeout !== 'function') {
    return options;
  }

  const timeoutSignal = AbortSignal.timeout(API_CONFIG.REQUEST_TIMEOUT);

  if (!options.signal) {
    return { ...options, signal: timeoutSignal };
  }

  if (typeof AbortSignal.any === 'function') {
    return { ...options, signal: AbortSignal.any([options.signal, timeoutSignal]) };
  }

  return options;
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Request aborted', 'AbortError');
  }

  const error = new Error('Request aborted');
  error.name = 'AbortError';
  return error;
}

function getLocalOpenRouterApiKey(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return localStorage.getItem(STORAGE_KEYS.OPENROUTER_API_KEY)?.trim() ?? '';
  } catch {
    return '';
  }
}

/**
 * Lee la clave de OpenRouter guardada localmente (sin fallback a `.env`).
 * Pensada para que Ajustes muestre el valor actual editable por el usuario.
 */
export function getStoredOpenRouterApiKey(): string {
  return getLocalOpenRouterApiKey();
}

/**
 * Persiste la clave de OpenRouter en localStorage. Una cadena vacía elimina la
 * clave guardada.
 */
export function saveOpenRouterApiKey(value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const trimmed = value.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEYS.OPENROUTER_API_KEY);
    }
  } catch {
    // Almacenamiento no disponible (modo privado, cuota); se ignora best-effort.
  }
}

export function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = getLocalOpenRouterApiKey();
  if (!apiKey) {
    throw new Error('Configura tu clave de OpenRouter en Ajustes > Perfil local.');
  }

  const baseUrl = import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const siteUrl =
    import.meta.env.VITE_OPENROUTER_SITE_URL ||
    import.meta.env.VITE_SITE_URL ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');
  const appTitle = import.meta.env.VITE_OPENROUTER_APP_TITLE || 'Ozyra Open';

  return {
    url: `${baseUrl.replace(/\/$/, '')}/chat/completions`,
    apiKey,
    siteUrl,
    appTitle,
  };
}

export function buildOpenRouterHeaders(): HeadersInit {
  const config = getOpenRouterConfig();

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'HTTP-Referer': config.siteUrl,
    'X-Title': config.appTitle,
  };
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt: number = 0
): Promise<Response> {
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  try {
    const response = await fetch(url, withRequestTimeout(options));

    if (!response.ok && isRetryableError(response.status) && attempt < API_CONFIG.MAX_RETRIES) {
      const delay = getBackoffDelay(attempt);
      console.info(
        `[ChatService] Error ${response.status}, reintentando en ${delay}ms (intento ${attempt + 1}/${API_CONFIG.MAX_RETRIES})`
      );
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }

    return response;
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    if (attempt < API_CONFIG.MAX_RETRIES) {
      const delay = getBackoffDelay(attempt);
      console.warn(
        `[ChatService] Error de red, reintentando en ${delay}ms (intento ${attempt + 1}/${API_CONFIG.MAX_RETRIES})`
      );
      await sleep(delay);
      return fetchWithRetry(url, options, attempt + 1);
    }
    throw error;
  }
}

export async function readOpenRouterError(response: Response): Promise<{
  detail: string;
  errorData: unknown;
}> {
  let detail = '';
  let errorData: unknown = null;

  try {
    const errJson = (await response.json()) as {
      details?: string;
      error?: string | { message?: string; metadata?: { provider_name?: string } };
    };
    errorData = errJson;

    if (typeof errJson.error === 'object' && errJson.error?.message) {
      detail = errJson.error.message;

      if (errJson.error.metadata?.provider_name) {
        detail += ` (${errJson.error.metadata.provider_name})`;
      }
    } else if (typeof errJson.details === 'string') {
      detail = errJson.details;
    } else if (typeof errJson.error === 'string') {
      detail = errJson.error;
    }
  } catch {
    try {
      detail = await response.text();
    } catch {
      detail = '';
    }
  }

  return { detail, errorData };
}

export function createOpenRouterHttpError(
  response: Response,
  detail: string,
  errorData: unknown
): Error {
  const status = response.status;

  if (status === 401) {
    return new Error('OpenRouter rechazó la clave API. Revísala en Ajustes > Perfil local.');
  }
  if (status === 400) {
    return new Error(`Solicitud inválida: ${detail || 'Revisa el modelo y el payload.'}`);
  }
  if (status === 429) {
    return new Error('Has alcanzado el límite de solicitudes. Por favor, espera un momento.');
  }
  if (status === 502 || status === 503) {
    const providerName = getProviderName(errorData) || 'El proveedor de IA';
    return new Error(
      `\u26a0\ufe0f ${providerName} está experimentando problemas técnicos (intentado ${API_CONFIG.MAX_RETRIES} veces). ` +
        'Por favor, intenta de nuevo en unos minutos o selecciona otro modelo.'
    );
  }
  if (status === 504) {
    return new Error(ERROR_MESSAGES.TIMEOUT_ERROR);
  }

  return new Error(`Error del servidor (${status}): ${detail || 'Error desconocido'}`);
}

function getProviderName(errorData: unknown): string | undefined {
  if (!errorData || typeof errorData !== 'object') {
    return undefined;
  }

  const error = (errorData as { error?: unknown }).error;
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const metadata = (error as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const providerName = (metadata as { provider_name?: unknown }).provider_name;
  return typeof providerName === 'string' ? providerName : undefined;
}

export function normalizeOpenRouterError(error: unknown): Error {
  if (error instanceof Error) {
    if (
      error.message.includes('proveedor') ||
      error.message.includes('temporalmente') ||
      error.message.includes('límite')
    ) {
      return error;
    }

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return new Error(ERROR_MESSAGES.TIMEOUT_ERROR);
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return new Error(ERROR_MESSAGES.NETWORK_ERROR);
    }

    return error;
  }

  return new Error(ERROR_MESSAGES.UNKNOWN_ERROR);
}

export async function fetchOpenRouterModels(): Promise<unknown[]> {
  const baseUrl = import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
  const url = new URL(`${baseUrl.replace(/\/$/, '')}/models`);
  url.searchParams.set('input_modalities', 'text');
  url.searchParams.set('output_modalities', 'text');

  let headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  try {
    const config = getOpenRouterConfig();
    if (config.apiKey) {
      headers = buildOpenRouterHeaders();
    }
  } catch {
    // If no API key is configured yet, fetch publicly without credential headers.
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data || !Array.isArray(data.data)) {
    throw new Error('Invalid response format from OpenRouter models endpoint');
  }

  return data.data;
}
