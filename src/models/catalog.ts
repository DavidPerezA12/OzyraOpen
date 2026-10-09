/**
 * Catálogo de modelos.
 *
 * Store inmutable con suscripción (compatible con `useSyncExternalStore`):
 * cada actualización crea un snapshot nuevo, así que los componentes que lo
 * leen con `useModelCatalog()` se re-renderizan sin contadores de versión ni
 * eventos globales. El catálogo sincronizado desde OpenRouter se cachea en
 * localStorage (validado al leerlo) y se refresca solo cuando caduca.
 */
import { useSyncExternalStore } from 'react';
import type { ModelCapabilities, ModelDefinition, ModelInfo, ModelPricing } from '../types';
import { fetchOpenRouterModels } from '../services/openrouter/client';
import { getBrowserLocalStorage } from '../utils/browserStorage';
import { isRecord } from '../utils/typeGuards';
import { logger } from '../utils/logger';
import { DEFAULT_MODELS } from './defaultModels';
import { resolveModelIcon } from './icons';
import { getProviderKey, mapOpenRouterModels, type OpenRouterApiModel } from './openRouterModels';
import { getRecentlyUsedModelIds } from './usage';

const CATALOG_CACHE_KEY = 'ozyra_openrouter_models_cache';
const CATALOG_CACHE_META_KEY = 'ozyra_openrouter_models_cache_meta';

/** Antigüedad a partir de la cual el catálogo sincronizado se refresca solo */
export const MODEL_CATALOG_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const PREFERRED_DEFAULT_MODEL_IDS = [
  'openai/gpt-5-chat',
  'openai/gpt-5',
  'anthropic/claude-sonnet-4.5',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-2.0-flash-001',
  'openrouter/auto',
];
const LAST_RESORT_MODEL_ID = 'openai/gpt-5-chat';
const INITIAL_ENABLED_MODELS_LIMIT = 8;

export interface ModelCatalogMeta {
  readonly source: 'openrouter' | 'fallback';
  readonly syncedAt: number | null;
  readonly count: number;
}

export interface ModelCatalog {
  readonly models: readonly ModelInfo[];
  readonly providerNames: readonly string[];
  readonly meta: ModelCatalogMeta;
}

// ---------------------------------------------------------------------------
// Validación del cache (acepta también el formato antiguo con alias)
// ---------------------------------------------------------------------------

const parseCapabilities = (value: unknown): ModelCapabilities | null => {
  if (!isRecord(value)) {
    return null;
  }
  const has = (...keys: string[]) => keys.some((key) => value[key] === true);
  return {
    fast: has('fast'),
    vision: has('vision', 'images'),
    reasoning: has('reasoning'),
    effortControl: has('effortControl', 'reasoningLevels'),
    toolCalling: has('toolCalling', 'tools'),
    imageGeneration: has('imageGeneration'),
    pdfComprehension: has('pdfComprehension', 'files'),
    thinking: has('thinking'),
    webSearch: has('webSearch'),
  };
};

const positiveNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;

const parsePricing = (value: unknown): ModelPricing | undefined =>
  isRecord(value) && typeof value.input === 'number' && typeof value.output === 'number'
    ? { input: value.input, output: value.output }
    : undefined;

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value : undefined;

export const parseModelDefinition = (value: unknown): ModelDefinition | null => {
  if (!isRecord(value)) {
    return null;
  }
  const id = nonEmptyString(value.id);
  const capabilities = parseCapabilities(value.capabilities);
  if (!id || !capabilities) {
    return null;
  }

  const contextLength = positiveNumber(value.contextLength);
  const maxTokens = positiveNumber(value.maxTokens);
  const pricing = parsePricing(value.pricing);

  return {
    id,
    name: nonEmptyString(value.name) ?? id,
    // `icon` era el nombre del campo en el formato antiguo del cache.
    iconKey: nonEmptyString(value.iconKey) ?? nonEmptyString(value.icon) ?? getProviderKey(id),
    displayProviderName: nonEmptyString(value.displayProviderName) ?? getProviderKey(id),
    tier: value.tier === 'premium' ? 'premium' : 'standard',
    description: typeof value.description === 'string' ? value.description : '',
    capabilities,
    ...(value.isRecommended === true ? { isRecommended: true } : {}),
    ...(value.isFeatured === true ? { isFeatured: true } : {}),
    ...(contextLength ? { contextLength } : {}),
    ...(maxTokens ? { maxTokens } : {}),
    ...(pricing ? { pricing } : {}),
  };
};

const readCachedDefinitions = (): ModelDefinition[] => {
  try {
    const raw = getBrowserLocalStorage()?.getItem(CATALOG_CACHE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.flatMap((item) => {
          const definition = parseModelDefinition(item);
          return definition ? [definition] : [];
        })
      : [];
  } catch (error) {
    logger.error('[Models] Error loading cached OpenRouter models', error);
    return [];
  }
};

const readCachedMeta = (): Pick<ModelCatalogMeta, 'source' | 'syncedAt'> | null => {
  try {
    const raw = getBrowserLocalStorage()?.getItem(CATALOG_CACHE_META_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }
    return {
      source: parsed.source === 'openrouter' ? 'openrouter' : 'fallback',
      syncedAt: typeof parsed.syncedAt === 'number' ? parsed.syncedAt : null,
    };
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface CatalogState {
  readonly catalog: ModelCatalog;
  readonly modelsById: ReadonlyMap<string, ModelInfo>;
}

const listeners = new Set<() => void>();

const buildCatalogState = (
  definitions: readonly ModelDefinition[],
  meta: Pick<ModelCatalogMeta, 'source' | 'syncedAt'>
): CatalogState => {
  const seen = new Set<string>();
  const models: ModelInfo[] = [];
  for (const definition of definitions) {
    if (seen.has(definition.id) || definition.capabilities.imageGeneration) {
      continue;
    }
    seen.add(definition.id);
    models.push({ ...definition, icon: resolveModelIcon(definition.iconKey) });
  }

  return {
    catalog: {
      models,
      providerNames: [...new Set(models.map((model) => model.displayProviderName))],
      meta: { ...meta, count: models.length },
    },
    modelsById: new Map(models.map((model) => [model.id, model] as const)),
  };
};

const createInitialState = (): CatalogState => {
  const cached = readCachedDefinitions();
  if (cached.length > 0) {
    return buildCatalogState(cached, readCachedMeta() ?? { source: 'openrouter', syncedAt: null });
  }
  return buildCatalogState(DEFAULT_MODELS, { source: 'fallback', syncedAt: null });
};

let state: CatalogState = createInitialState();

export const getModelCatalog = (): ModelCatalog => state.catalog;

export const subscribeToModelCatalog = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useModelCatalog = (): ModelCatalog =>
  useSyncExternalStore(subscribeToModelCatalog, getModelCatalog, getModelCatalog);

/**
 * Sustituye el catálogo por el sincronizado desde OpenRouter y lo cachea.
 * Una lista vacía (o solo de generación de imágenes) se ignora para no dejar
 * la app sin modelos.
 */
export const replaceModelCatalog = (
  definitions: readonly ModelDefinition[],
  syncedAt: number = Date.now()
): void => {
  const next = buildCatalogState(definitions, { source: 'openrouter', syncedAt });
  if (next.catalog.models.length === 0) {
    return;
  }

  state = next;
  try {
    const storage = getBrowserLocalStorage();
    storage?.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify(next.catalog.models.map(({ icon: _icon, ...definition }) => definition))
    );
    storage?.setItem(
      CATALOG_CACHE_META_KEY,
      JSON.stringify({ source: 'openrouter', syncedAt, count: next.catalog.meta.count })
    );
  } catch (error) {
    logger.error('[Models] Error saving OpenRouter models cache', error);
  }
  listeners.forEach((listener) => listener());
};

/** Descarga el catálogo de OpenRouter y lo aplica. */
export const syncModelCatalog = async (): Promise<void> => {
  const raw = await fetchOpenRouterModels();
  replaceModelCatalog(mapOpenRouterModels(raw as OpenRouterApiModel[]));
};

/**
 * Indica si el catálogo sincronizado ha caducado. El catálogo de reserva
 * nunca caduca: sincronizar por primera vez es una decisión del usuario
 * (cambia cientos de modelos), así que solo se refresca uno ya sincronizado.
 */
export const isModelCatalogStale = (now: number = Date.now()): boolean => {
  const { source, syncedAt } = state.catalog.meta;
  return (
    source === 'openrouter' && (syncedAt === null || now - syncedAt > MODEL_CATALOG_MAX_AGE_MS)
  );
};

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/**
 * Id que se envía a OpenRouter: quita las variantes de la app
 * (`-reasoning`, `:reasoning`) conservando `:online`.
 */
export const getOpenRouterApiModelId = (modelId: string): string =>
  modelId.replace(/(?:-reasoning|:reasoning)(?=:online$|$)/, '');

const withoutOnlineSuffix = (modelId: string): string => modelId.replace(/:online$/, '');

export const getModelInfo = (modelId: string): ModelInfo | undefined => {
  const { modelsById } = state;
  return (
    modelsById.get(modelId) ??
    modelsById.get(withoutOnlineSuffix(modelId)) ??
    modelsById.get(withoutOnlineSuffix(getOpenRouterApiModelId(modelId)))
  );
};

export const modelHasCapability = (modelId: string, capability: keyof ModelCapabilities): boolean =>
  Boolean(getModelInfo(modelId)?.capabilities[capability]);

export const isModelAvailable = (modelId: string): boolean => state.modelsById.has(modelId);

export const getDefaultModelId = (): string =>
  PREFERRED_DEFAULT_MODEL_IDS.find(isModelAvailable) ??
  state.catalog.models[0]?.id ??
  LAST_RESORT_MODEL_ID;

/** Devuelve el modelo pedido si existe en el catálogo actual o el modelo por defecto. */
export const getValidModelId = (requestedModelId: string | null | undefined): string => {
  if (requestedModelId && isModelAvailable(requestedModelId)) {
    return requestedModelId;
  }
  const fallbackModelId = getDefaultModelId();
  if (requestedModelId) {
    logger.warn(
      `Modelo "${requestedModelId}" no disponible en el catálogo. Usando: ${fallbackModelId}`
    );
  }
  return fallbackModelId;
};

/** Modelos activos por defecto: recientes + por defecto + destacados. */
export const getInitialEnabledModelIds = (): string[] => {
  const featured = state.catalog.models
    .filter((model) => model.isRecommended || model.isFeatured)
    .slice(0, INITIAL_ENABLED_MODELS_LIMIT)
    .map((model) => model.id);
  return [
    ...new Set([
      ...getRecentlyUsedModelIds(isModelAvailable, INITIAL_ENABLED_MODELS_LIMIT),
      getDefaultModelId(),
      ...featured,
    ]),
  ].filter(isModelAvailable);
};
