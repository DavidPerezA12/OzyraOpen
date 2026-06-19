import { Bot } from 'lucide-react';
import React, { type ElementType } from 'react';
import ai21Icon from '@lobehub/icons-static-svg/icons/ai21.svg';
import aionLabsIcon from '@lobehub/icons-static-svg/icons/aionlabs.svg';
import anthropicIcon from '@lobehub/icons-static-svg/icons/anthropic.svg';
import arceeIcon from '@lobehub/icons-static-svg/icons/arcee.svg';
import awsIcon from '@lobehub/icons-static-svg/icons/aws.svg';
import baiduIcon from '@lobehub/icons-static-svg/icons/baidu.svg';
import bytedanceIcon from '@lobehub/icons-static-svg/icons/bytedance.svg';
import cohereIcon from '@lobehub/icons-static-svg/icons/cohere.svg';
import deepCogitoIcon from '@lobehub/icons-static-svg/icons/deepcogito.svg';
import deepSeekIcon from '@lobehub/icons-static-svg/icons/deepseek.svg';
import essentialAiIcon from '@lobehub/icons-static-svg/icons/essentialai.svg';
import fireworksIcon from '@lobehub/icons-static-svg/icons/fireworks.svg';
import googleIcon from '@lobehub/icons-static-svg/icons/google.svg';
import groqIcon from '@lobehub/icons-static-svg/icons/groq.svg';
import ibmIcon from '@lobehub/icons-static-svg/icons/ibm.svg';
import inceptionIcon from '@lobehub/icons-static-svg/icons/inception.svg';
import inflectionIcon from '@lobehub/icons-static-svg/icons/inflection.svg';
import kwaipilotIcon from '@lobehub/icons-static-svg/icons/kwaipilot.svg';
import liquidIcon from '@lobehub/icons-static-svg/icons/liquid.svg';
import metaIcon from '@lobehub/icons-static-svg/icons/meta.svg';
import microsoftIcon from '@lobehub/icons-static-svg/icons/microsoft.svg';
import minimaxIcon from '@lobehub/icons-static-svg/icons/minimax.svg';
import mistralIcon from '@lobehub/icons-static-svg/icons/mistral.svg';
import moonshotIcon from '@lobehub/icons-static-svg/icons/moonshot.svg';
import morphIcon from '@lobehub/icons-static-svg/icons/morph.svg';
import nousResearchIcon from '@lobehub/icons-static-svg/icons/nousresearch.svg';
import nvidiaIcon from '@lobehub/icons-static-svg/icons/nvidia.svg';
import openAiIcon from '@lobehub/icons-static-svg/icons/openai.svg';
import openRouterIcon from '@lobehub/icons-static-svg/icons/openrouter.svg';
import perplexityIcon from '@lobehub/icons-static-svg/icons/perplexity.svg';
import qwenIcon from '@lobehub/icons-static-svg/icons/qwen.svg';
import relaceIcon from '@lobehub/icons-static-svg/icons/relace.svg';
import stepfunIcon from '@lobehub/icons-static-svg/icons/stepfun.svg';
import tencentIcon from '@lobehub/icons-static-svg/icons/tencent.svg';
import togetherIcon from '@lobehub/icons-static-svg/icons/together.svg';
import upstageIcon from '@lobehub/icons-static-svg/icons/upstage.svg';
import xAiIcon from '@lobehub/icons-static-svg/icons/xai.svg';
import xiaomiIcon from '@lobehub/icons-static-svg/icons/xiaomimimo.svg';
import zhipuIcon from '@lobehub/icons-static-svg/icons/zhipu.svg';
import type { ModelInfo, ModelTier } from '../types';
import { anthropicModels } from './Anthropic';
import { glmModels } from './GLM';
import { googleModels } from './Google';
import { openAIModels } from './OpenAI';
import type { ProviderModelList } from './types';

const OPENROUTER_MODELS_CACHE_KEY = 'ozyra_openrouter_models_cache';
const OPENROUTER_MODELS_CACHE_META_KEY = 'ozyra_openrouter_models_cache_meta';
const MODEL_USAGE_KEY = 'ozyra_model_usage';
export const MODEL_CATALOG_UPDATED_EVENT = 'ozyra:model-catalog-updated';

const PREFERRED_DEFAULT_MODEL_IDS = [
  'openai/gpt-5-chat',
  'openai/gpt-5',
  'anthropic/claude-sonnet-4.5',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-2.0-flash-001',
  'openrouter/auto',
];

export interface ModelCatalogMeta {
  readonly source: 'openrouter' | 'fallback';
  readonly syncedAt: number | null;
  readonly count: number;
}

export interface ModelUsageRecord {
  readonly id: string;
  readonly count: number;
  readonly lastUsedAt: number;
}

const PROVIDER_ICON_PATHS: Readonly<Record<string, string>> = {
  ai21: ai21Icon,
  'aion-labs': aionLabsIcon,
  aionlabs: aionLabsIcon,
  amazon: awsIcon,
  aws: awsIcon,
  anthropic: anthropicIcon,
  'arcee-ai': arceeIcon,
  arcee: arceeIcon,
  baidu: baiduIcon,
  bytedance: bytedanceIcon,
  'bytedance-seed': bytedanceIcon,
  cohere: cohereIcon,
  deepcogito: deepCogitoIcon,
  deepseek: deepSeekIcon,
  essentialai: essentialAiIcon,
  fireworks: fireworksIcon,
  glm: zhipuIcon,
  google: googleIcon,
  groq: groqIcon,
  'ibm-granite': ibmIcon,
  ibm: ibmIcon,
  inception: inceptionIcon,
  inflection: inflectionIcon,
  kwaipilot: kwaipilotIcon,
  liquid: liquidIcon,
  meta: metaIcon,
  'meta-llama': metaIcon,
  microsoft: microsoftIcon,
  minimax: minimaxIcon,
  mistral: mistralIcon,
  mistralai: mistralIcon,
  moonshot: moonshotIcon,
  moonshotai: moonshotIcon,
  morph: morphIcon,
  nousresearch: nousResearchIcon,
  nvidia: nvidiaIcon,
  openai: openAiIcon,
  openrouter: openRouterIcon,
  perplexity: perplexityIcon,
  qwen: qwenIcon,
  relace: relaceIcon,
  stepfun: stepfunIcon,
  tencent: tencentIcon,
  together: togetherIcon,
  upstage: upstageIcon,
  'x-ai': xAiIcon,
  xai: xAiIcon,
  xiaomi: xiaomiIcon,
  'z-ai': zhipuIcon,
  zhipu: zhipuIcon,
};

const providerIconCache = new Map<string, ElementType>();

const createImageIcon = (src: string): ElementType => {
  const cached = providerIconCache.get(src);
  if (cached) {
    return cached;
  }

  const ImageIcon = ({
    className,
    size = 20,
    style,
  }: {
    className?: string;
    size?: number;
    style?: React.CSSProperties;
  }) =>
    React.createElement('img', {
      src,
      className: ['model-provider-logo', className].filter(Boolean).join(' '),
      style: {
        width: size,
        height: size,
        objectFit: 'contain',
        ...style,
      },
      alt: '',
      'aria-hidden': true,
      draggable: false,
    });

  ImageIcon.displayName = `ModelIcon(${src})`;
  providerIconCache.set(src, ImageIcon as ElementType);
  return ImageIcon as ElementType;
};

const normalizeIcon = (icon: ElementType | string | undefined): ElementType => {
  if (!icon) {
    return Bot;
  }

  if (typeof icon === 'string') {
    const lowerIcon = icon.toLowerCase().replace(/^~/, '');

    const providerIconPath = PROVIDER_ICON_PATHS[lowerIcon];
    if (providerIconPath) {
      return createImageIcon(providerIconPath);
    }

    if (icon.startsWith('/') || icon.startsWith('http')) {
      return createImageIcon(icon);
    }
    return Bot;
  }

  return icon;
};

// Helper function para convertir modelos del formato anterior al nuevo
const convertToNewModelFormat = (oldModels: ProviderModelList): ModelInfo[] => {
  return oldModels.map((model) => ({
    id: model.id,
    name: model.name,
    icon: normalizeIcon(model.icon),
    provider: model.provider || 'openrouter',
    displayProviderName: model.displayProviderName,
    tier: (model.tier || 'standard') as 'standard' | 'premium',
    description: model.description,
    capabilities: {
      fast: Boolean(model.isFast),
      vision: Boolean(model.supportsVision || model.supportsImages),
      reasoning: Boolean(model.isReasoning),
      effortControl: Boolean(model.supportsReasoningLevels),
      toolCalling: Boolean(model.supportsToolCalling || model.supportsTools),
      imageGeneration: Boolean(model.supportsImageGeneration),
      pdfComprehension: Boolean(model.supportsPdfComprehension || model.supportsFileProcessing),
      thinking: Boolean(model.supportsThinking),
      images: Boolean(model.supportsImages),
      files: Boolean(model.supportsFileProcessing),
      webSearch: Boolean(model.supportsWebSearch),
      tools: Boolean(model.supportsTools),
      reasoningLevels: Boolean(model.supportsReasoningLevels),
    },
    isRecommended: model.isRecommended,
    isSpecial: model.isSpecial,
    isNew: model.isNew,
    isFeatured: model.isFeatured,
  }));
};

const getLocalStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

const loadCachedOpenRouterModels = (): ModelInfo[] => {
  const storage = getLocalStorage();
  if (!storage) {
    return [];
  }
  try {
    const cached = storage.getItem(OPENROUTER_MODELS_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return (parsed as ModelInfo[]).flatMap((model) =>
          model.capabilities?.imageGeneration
            ? []
            : [
                {
                  ...model,
                  icon: normalizeIcon(model.icon),
                },
              ]
        );
      }
    }
  } catch (e) {
    console.error('Error loading cached OpenRouter models', e);
  }
  return [];
};

const defaultModels = [
  ...convertToNewModelFormat(openAIModels),
  ...convertToNewModelFormat(anthropicModels),
  ...convertToNewModelFormat(glmModels),
  ...convertToNewModelFormat(googleModels),
];

const cachedOpenRouterModels = loadCachedOpenRouterModels();

const getSerializableModel = (model: ModelInfo): ModelInfo => ({
  ...model,
  icon: typeof model.icon === 'string' ? model.icon : model.displayProviderName.toLowerCase(),
});

const dedupeModels = (models: readonly ModelInfo[]): ModelInfo[] => {
  const seen = new Set<string>();
  const deduped: ModelInfo[] = [];
  for (const model of models) {
    if (seen.has(model.id)) {
      continue;
    }
    seen.add(model.id);
    deduped.push({
      ...model,
      icon: normalizeIcon(model.icon),
    });
  }
  return deduped;
};

const readModelUsageRecords = (): ModelUsageRecord[] => {
  const storage = getLocalStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(MODEL_USAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item): item is ModelUsageRecord => {
        if (!item || typeof item !== 'object') {
          return false;
        }
        const record = item as Partial<ModelUsageRecord>;
        return (
          typeof record.id === 'string' &&
          typeof record.count === 'number' &&
          typeof record.lastUsedAt === 'number'
        );
      })
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } catch (error) {
    console.warn('[Models] Failed to read model usage stats', error);
    return [];
  }
};

const writeModelUsageRecords = (records: readonly ModelUsageRecord[]): void => {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(MODEL_USAGE_KEY, JSON.stringify(records.slice(0, 40)));
  } catch (error) {
    console.warn('[Models] Failed to save model usage stats', error);
  }
};

const normalizeUsedModelId = (modelId: string): string =>
  modelId.replace(/:online$/, '').replace(/(?:-reasoning|:reasoning)(?=:online$|$)/, '');

const emitModelCatalogUpdated = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(MODEL_CATALOG_UPDATED_EVENT));
};

// Lista de modelos disponibles para mostrar en la interfaz de usuario (mutable)
export const availableModels: ModelInfo[] =
  cachedOpenRouterModels.length > 0
    ? dedupeModels(cachedOpenRouterModels)
    : dedupeModels(defaultModels);

// Obtener lista única de nombres de proveedores para mostrar en filtros (mutable)
export const uniqueDisplayProviderNames: string[] = [];

const updateUniqueDisplayProviderNames = () => {
  uniqueDisplayProviderNames.length = 0;
  uniqueDisplayProviderNames.push(...new Set(availableModels.map((m) => m.displayProviderName)));
};

// Inicializar proveedores únicos
updateUniqueDisplayProviderNames();

const getDefaultAvailableModelId = (): string => {
  const preferred = PREFERRED_DEFAULT_MODEL_IDS.find((id) =>
    availableModels.some((model) => model.id === id)
  );
  return preferred ?? availableModels[0]?.id ?? 'openai/gpt-5-chat';
};

// Modelo por defecto inicial. getValidModelId recalcula contra el catalogo actual.
export const DEFAULT_MODEL_ID = getDefaultAvailableModelId();

// Función para obtener un modelo válido, usando el por defecto como fallback
export const getValidModelId = (requestedModelId: string | null | undefined): string => {
  if (requestedModelId && availableModels.some((m) => m.id === requestedModelId)) {
    return requestedModelId;
  }

  // Si el modelo solicitado no es válido o no existe, usar el por defecto
  const fallbackModelId = getDefaultAvailableModelId();
  console.warn(
    `Modelo solicitado "${requestedModelId}" no es válido o no está disponible. Usando por defecto: ${fallbackModelId}`
  );
  return fallbackModelId;
};

export interface OpenRouterApiModel {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly context_length: number;
  readonly pricing?: {
    readonly prompt?: string;
    readonly completion?: string;
    readonly image?: string;
    readonly request?: string;
  };
  readonly architecture?: {
    readonly input_modalities?: readonly string[];
    readonly output_modalities?: readonly string[];
    readonly modality?: string;
  };
  readonly supported_parameters?: readonly string[];
  readonly top_provider?: {
    readonly max_completion_tokens?: number;
    readonly context_length?: number;
  } | null;
  readonly created?: number;
}

const normalizeModality = (modality: string): string =>
  modality.trim().toLowerCase().replace(/_/g, '-');

const modalitiesIncludeText = (modalities: readonly string[] | undefined): boolean =>
  Boolean(modalities?.some((modality) => normalizeModality(modality) === 'text'));

const modalityRouteIncludesText = (
  route: string | undefined,
  direction: 'input' | 'output'
): boolean => {
  if (!route) {
    return false;
  }

  const [input = '', output = ''] = route.toLowerCase().split('->');
  const side = direction === 'input' ? input : output;
  return side
    .split(/[,+/|]/)
    .map(normalizeModality)
    .includes('text');
};

export const openRouterModelSupportsTextInTextOut = (model: OpenRouterApiModel): boolean => {
  const inputModalities = model.architecture?.input_modalities;
  const outputModalities = model.architecture?.output_modalities;
  const modalityRoute = model.architecture?.modality;

  const supportsTextInput =
    modalitiesIncludeText(inputModalities) || modalityRouteIncludesText(modalityRoute, 'input');
  const supportsTextOutput =
    modalitiesIncludeText(outputModalities) || modalityRouteIncludesText(modalityRoute, 'output');

  return supportsTextInput && supportsTextOutput;
};

// Maps an OpenRouter API model item into Ozyra's ModelInfo format
export const mapOpenRouterModelToInfo = (model: OpenRouterApiModel): ModelInfo => {
  const providerKey = model.id.split('/')[0];

  // Format provider name nicely
  let displayProviderName = providerKey;
  if (providerKey === 'openai') {
    displayProviderName = 'OpenAI';
  } else if (providerKey === 'anthropic') {
    displayProviderName = 'Anthropic';
  } else if (providerKey === 'google') {
    displayProviderName = 'Google';
  } else if (providerKey === 'z-ai') {
    displayProviderName = 'GLM';
  } else if (providerKey === 'meta-llama') {
    displayProviderName = 'Meta';
  } else if (providerKey === 'mistralai') {
    displayProviderName = 'Mistral';
  } else if (providerKey === 'cohere') {
    displayProviderName = 'Cohere';
  } else if (providerKey === 'deepseek') {
    displayProviderName = 'DeepSeek';
  } else if (providerKey === 'perplexity') {
    displayProviderName = 'Perplexity';
  } else if (providerKey === 'qwen') {
    displayProviderName = 'Qwen';
  } else if (providerKey === 'x-ai') {
    displayProviderName = 'xAI';
  } else if (providerKey) {
    displayProviderName = providerKey.charAt(0).toUpperCase() + providerKey.slice(1);
  } else {
    displayProviderName = 'OpenRouter';
  }

  // Determine capabilities
  const isReasoning =
    model.supported_parameters?.includes('reasoning') ||
    model.id.includes('reasoning') ||
    model.id.includes('thinking') ||
    model.id.includes('-r1') ||
    model.id.startsWith('openai/o1') ||
    model.id.startsWith('openai/o3');

  const supportsImages =
    model.architecture?.input_modalities?.includes('image') ||
    model.architecture?.input_modalities?.includes('multimodal') ||
    model.architecture?.input_modalities?.includes('vision') ||
    model.id.includes('vision') ||
    model.id.includes('vl');

  const supportsTools = Boolean(model.supported_parameters?.includes('tools'));
  const supportsThinking = Boolean(
    model.supported_parameters?.includes('thinking') ||
    model.id.includes('thinking') ||
    model.id.includes('-r1')
  );
  const supportsReasoningLevels = Boolean(
    model.supported_parameters?.includes('reasoning') ||
    model.id.includes('claude-3-7-sonnet') ||
    model.id.includes('claude-sonnet-4.5') ||
    model.id.startsWith('openai/o1') ||
    model.id.startsWith('openai/o3')
  );

  const hasPricing = Boolean(model.pricing?.prompt && model.pricing?.completion);
  const promptPrice = parseFloat(model.pricing?.prompt || '0');
  const completionPrice = parseFloat(model.pricing?.completion || '0');
  const inputMillionPrice = promptPrice * 1000000;
  const outputMillionPrice = completionPrice * 1000000;

  const tier: ModelTier =
    inputMillionPrice > 2.0 || outputMillionPrice > 5.0 ? 'premium' : 'standard';

  const isFast =
    (hasPricing && inputMillionPrice < 0.5) ||
    model.id.includes('flash') ||
    model.id.includes('mini') ||
    model.id.includes('lite') ||
    model.id.includes('haiku') ||
    model.id.includes('fast') ||
    model.id.includes('speed');

  return {
    id: model.id,
    name: model.name || model.id,
    icon: normalizeIcon(providerKey),
    provider: 'openrouter',
    displayProviderName,
    tier,
    description:
      model.description || `Modelo ${model.name || model.id} disponible a través de OpenRouter.`,
    capabilities: {
      fast: isFast,
      vision: supportsImages,
      reasoning: isReasoning,
      effortControl: supportsReasoningLevels,
      toolCalling: supportsTools,
      imageGeneration:
        model.architecture?.output_modalities?.includes('image') ||
        model.id.includes('dall-e') ||
        model.id.includes('flux') ||
        model.id.includes('stable-diffusion'),
      pdfComprehension: model.context_length >= 32000,
      thinking: supportsThinking,
      images: supportsImages,
      files: model.context_length >= 32000,
      webSearch: true,
      tools: supportsTools,
      reasoningLevels: supportsReasoningLevels,
    },
    contextLength: model.context_length,
    pricing: hasPricing
      ? {
          input: inputMillionPrice,
          output: outputMillionPrice,
        }
      : undefined,
    maxTokens: model.top_provider?.max_completion_tokens,
  };
};

export const getModelCatalogMeta = (): ModelCatalogMeta => {
  const storage = getLocalStorage();
  if (!storage) {
    return {
      source: cachedOpenRouterModels.length > 0 ? 'openrouter' : 'fallback',
      syncedAt: null,
      count: availableModels.length,
    };
  }

  try {
    const raw = storage.getItem(OPENROUTER_MODELS_CACHE_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ModelCatalogMeta>;
      return {
        source: parsed.source === 'openrouter' ? 'openrouter' : 'fallback',
        syncedAt: typeof parsed.syncedAt === 'number' ? parsed.syncedAt : null,
        count: typeof parsed.count === 'number' ? parsed.count : availableModels.length,
      };
    }
  } catch {
    // Fall through to current in-memory source.
  }

  return {
    source: cachedOpenRouterModels.length > 0 ? 'openrouter' : 'fallback',
    syncedAt: null,
    count: availableModels.length,
  };
};

export const getModelCatalogSnapshot = (): string => JSON.stringify(getModelCatalogMeta());

export const subscribeToModelCatalog = (onStoreChange: () => void): (() => void) => {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  window.addEventListener(MODEL_CATALOG_UPDATED_EVENT, onStoreChange);
  return () => window.removeEventListener(MODEL_CATALOG_UPDATED_EVENT, onStoreChange);
};

export const getRecentlyUsedModelIds = (limit = 8): string[] => {
  const availableIds = new Set(availableModels.map((model) => model.id));
  return readModelUsageRecords()
    .filter((record) => availableIds.has(record.id))
    .slice(0, limit)
    .map((record) => record.id);
};

export const getModelUsageScore = (modelId: string): number => {
  const record = readModelUsageRecords().find((item) => item.id === normalizeUsedModelId(modelId));
  if (!record) {
    return 0;
  }
  return record.lastUsedAt + record.count;
};

export const getModelUsageScores = (): ReadonlyMap<string, number> =>
  new Map(
    readModelUsageRecords().map((record) => [record.id, record.lastUsedAt + record.count] as const)
  );

export const recordModelUsage = (modelId: string): void => {
  const normalizedId = normalizeUsedModelId(modelId);
  if (!availableModels.some((model) => model.id === normalizedId)) {
    return;
  }

  const now = Date.now();
  const existing = readModelUsageRecords();
  const next = [
    {
      id: normalizedId,
      count: (existing.find((record) => record.id === normalizedId)?.count ?? 0) + 1,
      lastUsedAt: now,
    },
    ...existing.filter((record) => record.id !== normalizedId),
  ].sort((a, b) => b.lastUsedAt - a.lastUsedAt);

  writeModelUsageRecords(next);
  emitModelCatalogUpdated();
};

export const getInitialEnabledModelIds = (): string[] => {
  const recent = getRecentlyUsedModelIds(8);
  const fallback = getDefaultAvailableModelId();
  const featured = availableModels
    .filter((model) => model.isRecommended || model.isFeatured)
    .slice(0, 8)
    .map((model) => model.id);
  return [...new Set([...recent, fallback, ...featured])].filter((id) =>
    availableModels.some((model) => model.id === id)
  );
};

// Mutates availableModels in place with the fetched OpenRouter catalog, then persists to localStorage.
export const updateAvailableModels = (newModels: ModelInfo[]) => {
  const normalizedModels = dedupeModels(
    newModels.filter((model) => !model.capabilities.imageGeneration)
  );
  if (normalizedModels.length === 0) {
    return;
  }

  availableModels.length = 0;
  availableModels.push(...normalizedModels);

  updateUniqueDisplayProviderNames();

  const serializableModels = availableModels.map(getSerializableModel);

  const storage = getLocalStorage();
  if (!storage) {
    emitModelCatalogUpdated();
    return;
  }
  try {
    storage.setItem(OPENROUTER_MODELS_CACHE_KEY, JSON.stringify(serializableModels));
    storage.setItem(
      OPENROUTER_MODELS_CACHE_META_KEY,
      JSON.stringify({
        source: 'openrouter',
        syncedAt: Date.now(),
        count: availableModels.length,
      } satisfies ModelCatalogMeta)
    );
  } catch (e) {
    console.error('Error saving OpenRouter models cache to localStorage', e);
  } finally {
    emitModelCatalogUpdated();
  }
};
