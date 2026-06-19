/**
 * Models Configuration
 *
 * Configuración centralizada de modelos de IA con utilidades y helpers.
 *
 * Funcionalidades principales:
 * - Re-exportación de modelos y funciones principales
 * - Utilidades para filtrado y búsqueda de modelos
 * - Helpers para capacidades y características de modelos
 * - Funciones de validación y selección automática
 * - Mapeo de proveedores y configuración de API
 * - Constantes y configuraciones por defecto
 *
 * @module ModelsConfig
 * @example
 * ```tsx
 * import {
 *   availableModels,
 *   getModelInfo,
 *   modelHasCapability
 * } from '../config/models';
 *
 * // Obtener información de modelo
 * const modelInfo = getModelInfo('openai/gpt-5-chat');
 *
 * // Verificar capacidad
 * const hasImages = modelHasCapability('openai/gpt-5-chat', 'images');
 * ```
 */
import {
  Brain,
  Zap,
  Eye,
  Gauge,
  Wrench,
  FileText,
  Image,
  Camera as CameraIcon,
  Globe,
} from 'lucide-react';
import {
  DEFAULT_MODEL_ID as defaultModel,
  getValidModelId as getValidModel,
  availableModels as importedModels,
  uniqueDisplayProviderNames as providerNames,
  mapOpenRouterModelToInfo as mapper,
  updateAvailableModels as updater,
  getInitialEnabledModelIds as initialEnabledIds,
  getModelCatalogMeta as catalogMeta,
  getModelCatalogSnapshot as catalogSnapshot,
  getModelUsageScore as usageScore,
  getModelUsageScores as usageScores,
  getRecentlyUsedModelIds as recentModelIds,
  recordModelUsage as usageRecorder,
  openRouterModelSupportsTextInTextOut as textInTextOutFilter,
  MODEL_CATALOG_UPDATED_EVENT,
  subscribeToModelCatalog as catalogSubscriber,
  type OpenRouterApiModel,
  type ModelCatalogMeta,
} from '../providers/models';
import type { ModelCapabilities, ModelInfo, ModelTier } from '../types';

// Re-exportar modelos y funciones principales
export const availableModels = importedModels;
export const DEFAULT_MODEL_ID = defaultModel;
export const getValidModelId = getValidModel;
export const uniqueDisplayProviderNames = providerNames;
export const mapOpenRouterModelToInfo = mapper;
let modelsById = new Map(importedModels.map((model) => [model.id, model] as const));

export const updateAvailableModels = (models: ModelInfo[]): void => {
  updater(models);
  modelsById = new Map(importedModels.map((model) => [model.id, model] as const));
};
export const getInitialEnabledModelIds = initialEnabledIds;
export const getModelCatalogMeta = catalogMeta;
export const getModelCatalogSnapshot = catalogSnapshot;
export const subscribeToModelCatalog = catalogSubscriber;
export const getModelUsageScore = usageScore;
export const getModelUsageScores = usageScores;
export const getRecentlyUsedModelIds = recentModelIds;
export const recordModelUsage = usageRecorder;
export const openRouterModelSupportsTextInTextOut = textInTextOutFilter;
export { MODEL_CATALOG_UPDATED_EVENT };
export type { OpenRouterApiModel, ModelCatalogMeta };

// Helper function para crear capabilities de forma consistente
export const createCapabilities = (
  options: Partial<ModelCapabilities> = {}
): ModelCapabilities => ({
  fast: false,
  vision: false,
  reasoning: false,
  effortControl: false,
  toolCalling: false,
  imageGeneration: false,
  pdfComprehension: false,
  thinking: false,
  images: false,
  files: false,
  webSearch: false,
  tools: false,
  reasoningLevels: false,
  ...options,
});

// Funciones de utilidad para filtrar modelos
export const getModelsByTier = (tier: ModelTier): ModelInfo[] =>
  availableModels.filter((m) => m.tier === tier);

export const getModelsByCapability = (capability: keyof ModelCapabilities): ModelInfo[] =>
  availableModels.filter((m) => m.capabilities[capability]);

export const getRecommendedModels = (): ModelInfo[] =>
  availableModels.filter((m) => m.isRecommended);

export const getFeaturedModels = (): ModelInfo[] => availableModels.filter((m) => m.isFeatured);

export const getNewModels = (): ModelInfo[] => availableModels.filter((m) => m.isNew);

const withoutOnlineSuffix = (modelId: string): string => modelId.replace(/:online$/, '');

export const getOpenRouterApiModelId = (modelId: string): string =>
  modelId.replace(/(?:-reasoning|:reasoning)(?=:online$|$)/, '');

// Función para obtener información de un modelo por ID
export const getModelInfo = (modelId: string): ModelInfo | undefined => {
  const displayModelId = withoutOnlineSuffix(modelId);
  const apiBaseModelId = withoutOnlineSuffix(getOpenRouterApiModelId(modelId));
  const candidates = [modelId, displayModelId, apiBaseModelId];

  for (const candidate of candidates) {
    const model = modelsById.get(candidate);
    if (model) {
      return model;
    }
  }

  return undefined;
};

// Función para verificar si un modelo tiene una capacidad específica
export const modelHasCapability = (
  modelId: string,
  capability: keyof ModelCapabilities
): boolean => {
  const model = getModelInfo(modelId);
  if (!model) {
    return false;
  }

  switch (capability) {
    case 'images':
      return model.capabilities.vision || model.capabilities.images;
    case 'files':
      return model.capabilities.pdfComprehension || model.capabilities.files;
    case 'tools':
      return model.capabilities.toolCalling || model.capabilities.tools;
    case 'reasoningLevels':
      return model.capabilities.effortControl || model.capabilities.reasoningLevels;
    case 'webSearch':
      return model.capabilities.webSearch;
    default:
      return model.capabilities[capability];
  }
};

// Función para obtener el icono de una capacidad
export const getCapabilityIcon = (capability: keyof ModelCapabilities) => {
  const iconMap = {
    fast: Zap,
    vision: Eye,
    reasoning: Brain,
    effortControl: Gauge,
    toolCalling: Wrench,
    imageGeneration: Image,
    pdfComprehension: FileText,
    thinking: Brain,
    images: CameraIcon,
    files: FileText,
    webSearch: Globe,
    tools: Wrench,
    reasoningLevels: Brain,
  } as const;
  return iconMap[capability];
};

// Función para obtener el color de una capacidad
export const getCapabilityColor = (capability: keyof ModelCapabilities) => {
  const colorMap = {
    fast: 'text-yellow-500',
    vision: 'text-blue-500',
    reasoning: 'text-sky-500',
    effortControl: 'text-blue-500',
    toolCalling: 'text-emerald-500',
    imageGeneration: 'text-pink-500',
    pdfComprehension: 'text-green-500',
    thinking: 'text-cyan-500',
    images: 'text-blue-400',
    files: 'text-green-400',
    webSearch: 'text-orange-500',
    tools: 'text-emerald-400',
    reasoningLevels: 'text-blue-400',
  } as const;
  return colorMap[capability];
};

export const modelCapabilities: Record<
  string,
  {
    reasoning?: boolean;
    tools?: boolean;
    vision?: boolean;
    reasoningType?: 'effort' | 'max_tokens';
  }
> = {
  'openai/o1-mini': { reasoning: true, tools: true, vision: false, reasoningType: 'effort' },
  'openai/o1-preview': { reasoning: true, tools: true, vision: false, reasoningType: 'effort' },
  'openai/o3-mini': { reasoning: true, tools: true, vision: false, reasoningType: 'effort' },

  'anthropic/claude-3-5-sonnet': {
    reasoning: true,
    tools: true,
    vision: true,
    reasoningType: 'max_tokens',
  },
  'anthropic/claude-3-7-sonnet': {
    reasoning: true,
    tools: true,
    vision: true,
    reasoningType: 'max_tokens',
  },
  'anthropic/claude-sonnet-4.5': {
    reasoning: true,
    tools: true,
    vision: true,
    reasoningType: 'max_tokens',
  },

  'deepseek/deepseek-r1': { reasoning: true, tools: true, vision: false, reasoningType: 'effort' },

  'anthropic/claude-3-haiku': { reasoning: false, tools: true, vision: true },
  'openai/gpt-4': { reasoning: false, tools: true, vision: true },
  'openai/gpt-5-chat': { reasoning: false, tools: true, vision: true },
  'openai/gpt-5': { reasoning: true, tools: true, vision: true, reasoningType: 'effort' },
};

export const getReasoningConfig = (
  modelId: string,
  userConfig?: { effort?: 'low' | 'medium' | 'high'; max_tokens?: number; exclude?: boolean }
) => {
  const caps = modelCapabilities[modelId];
  if (!caps?.reasoning) {
    return undefined;
  }
  const cfg: {
    enabled: true;
    effort?: 'low' | 'medium' | 'high';
    max_tokens?: number;
    exclude?: boolean;
  } = { enabled: true };
  if (caps.reasoningType === 'effort') {
    cfg.effort = userConfig?.effort || 'medium';
  } else if (caps.reasoningType === 'max_tokens') {
    if (typeof userConfig?.max_tokens === 'number') {
      cfg.max_tokens = userConfig.max_tokens;
    } else if (userConfig?.effort) {
      // Map effort buttons to max_tokens budget for models like Anthropic Sonnet 4.5
      const map: Record<'low' | 'medium' | 'high', number> = {
        low: 1024,
        medium: 2000,
        high: 4000,
      };
      cfg.max_tokens = map[userConfig.effort] ?? 2000;
    } else {
      cfg.max_tokens = 2000;
    }
  }
  if (userConfig && Object.prototype.hasOwnProperty.call(userConfig, 'exclude')) {
    cfg.exclude = userConfig.exclude;
  }
  return cfg;
};
