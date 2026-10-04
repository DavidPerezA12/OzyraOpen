import { API_CONFIG, STORAGE_KEYS } from '../../config/constants';
import { t } from '../../i18n';
import {
  readTrimmedLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '../../utils/browserStorage';
import { isRecord } from '../../utils/typeGuards';
import { logger } from '../../utils/logger';
import type { OpenRouterConfig } from './types';

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const handleAbort = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(createAbortError());
    };

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
    };

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
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

const OPENROUTER_PROD_BASE_URL = 'https://openrouter.ai/api/v1';

const isLocalhostBaseUrl = (value: string): boolean =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);

/**
 * Resuelve la URL base de OpenRouter con allowlist estricta.
 *
 * Sin allowlist, un `VITE_OPENROUTER_BASE_URL` envenenado (build o phishing)
 * enviaría `Authorization: Bearer <key>` a un host atacante. Solo se permite
 * el endpoint oficial de producción; en desarrollo también localhost.
 */
export function resolveOpenRouterBaseUrl(): string {
  const raw = (import.meta.env.VITE_OPENROUTER_BASE_URL || OPENROUTER_PROD_BASE_URL).trim();
  const normalized = raw.replace(/\/$/, '');

  if (normalized === OPENROUTER_PROD_BASE_URL) {
    return normalized;
  }

  if (import.meta.env.DEV && isLocalhostBaseUrl(normalized)) {
    return normalized;
  }

  throw new Error(t('openRouterBaseUrlNotAllowed'));
}

const getLocalOpenRouterApiKey = (): string =>
  readTrimmedLocalStorage(STORAGE_KEYS.OPENROUTER_API_KEY);

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
  const trimmed = value.trim();
  if (trimmed) {
    writeLocalStorage(STORAGE_KEYS.OPENROUTER_API_KEY, trimmed);
  } else {
    removeLocalStorage(STORAGE_KEYS.OPENROUTER_API_KEY);
  }
}

export function getOpenRouterConfig(): OpenRouterConfig {
  const apiKey = getLocalOpenRouterApiKey();
  if (!apiKey) {
    throw new Error(t('missingOpenRouterKey'));
  }

  const baseUrl = resolveOpenRouterBaseUrl();
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
      logger.info(
        `[ChatService] Error ${response.status}, reintentando en ${delay}ms (intento ${attempt + 1}/${API_CONFIG.MAX_RETRIES})`
      );
      await sleep(delay, options.signal ?? undefined);
      return fetchWithRetry(url, options, attempt + 1);
    }

    return response;
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    if (attempt < API_CONFIG.MAX_RETRIES) {
      const delay = getBackoffDelay(attempt);
      logger.warn(
        `[ChatService] Error de red, reintentando en ${delay}ms (intento ${attempt + 1}/${API_CONFIG.MAX_RETRIES})`
      );
      await sleep(delay, options.signal ?? undefined);
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
  let rawBody = '';

  try {
    rawBody = await response.text();
    const errJson = JSON.parse(rawBody) as {
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
    // Evitar volcar HTML gigante en el toast: recortar a 500 caracteres.
    detail = rawBody.length > 500 ? `${rawBody.slice(0, 500)}…` : rawBody;
  }

  return { detail, errorData };
}

/**
 * Error HTTP de OpenRouter con mensaje ya listo para mostrar al usuario.
 * `normalizeOpenRouterError` lo deja pasar sin reescribirlo.
 */
export class OpenRouterHttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'OpenRouterHttpError';
    this.status = status;
  }
}

export function createOpenRouterHttpError(
  response: Response,
  detail: string,
  errorData: unknown
): Error {
  const status = response.status;

  if (status === 401) {
    return new OpenRouterHttpError(t('openRouterInvalidKey'), status);
  }
  if (status === 400) {
    return new OpenRouterHttpError(
      t('openRouterBadRequest', { detail: detail || t('openRouterBadRequestHint') }),
      status
    );
  }
  if (status === 429) {
    return new OpenRouterHttpError(t('openRouterRateLimited'), status);
  }
  if (status === 502 || status === 503) {
    const providerName = getProviderName(errorData) || t('openRouterDefaultProvider');
    return new OpenRouterHttpError(
      t('openRouterProviderDown', { provider: providerName, retries: API_CONFIG.MAX_RETRIES }),
      status
    );
  }
  if (status === 504) {
    return new OpenRouterHttpError(t('timeoutError'), status);
  }

  return new OpenRouterHttpError(
    t('openRouterServerError', { status, detail: detail || t('unknownError') }),
    status
  );
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
    if (error.name === 'OpenRouterHttpError') {
      return error;
    }

    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return new Error(t('timeoutError'));
    }

    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return new Error(t('networkError'));
    }

    return error;
  }

  return new Error(t('unknownError'));
}

export async function fetchOpenRouterModels(): Promise<unknown[]> {
  const baseUrl = resolveOpenRouterBaseUrl();
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

  const response = await fetch(
    url.toString(),
    withRequestTimeout({
      method: 'GET',
      headers,
    })
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!isRecord(data) || !Array.isArray(data.data)) {
    throw new Error('Invalid response format from OpenRouter models endpoint');
  }

  // Filtrar entradas malformadas: consumidores como mapOpenRouterModelToInfo
  // asumen `id` string (hacen `model.id.split('/')`).
  return data.data.filter(
    (entry): entry is { readonly id: string } & Record<string, unknown> =>
      isRecord(entry) && typeof entry.id === 'string' && entry.id.length > 0
  );
}
