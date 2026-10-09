import type { ModelDefinition, ModelTier } from '../types';

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

const modalitiesInclude = (modalities: readonly string[] | undefined, modality: string): boolean =>
  Boolean(modalities?.some((candidate) => normalizeModality(candidate) === modality));

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
  const { input_modalities, output_modalities, modality } = model.architecture ?? {};

  const supportsTextInput =
    modalitiesInclude(input_modalities, 'text') || modalityRouteIncludesText(modality, 'input');
  const supportsTextOutput =
    modalitiesInclude(output_modalities, 'text') || modalityRouteIncludesText(modality, 'output');

  return supportsTextInput && supportsTextOutput;
};

const PROVIDER_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'z-ai': 'GLM',
  'meta-llama': 'Meta',
  mistralai: 'Mistral',
  cohere: 'Cohere',
  deepseek: 'DeepSeek',
  perplexity: 'Perplexity',
  qwen: 'Qwen',
  'x-ai': 'xAI',
};

export const getProviderKey = (modelId: string): string =>
  modelId.split('/')[0]?.replace(/^~/, '') ?? '';

const getDisplayProviderName = (providerKey: string): string =>
  PROVIDER_DISPLAY_NAMES[providerKey] ??
  (providerKey ? providerKey.charAt(0).toUpperCase() + providerKey.slice(1) : 'OpenRouter');

const PREMIUM_INPUT_PRICE_PER_MILLION = 2;
const PREMIUM_OUTPUT_PRICE_PER_MILLION = 5;
const FAST_INPUT_PRICE_PER_MILLION = 0.5;
const DOCUMENT_CONTEXT_THRESHOLD = 32_000;

/** Convierte un modelo del endpoint `/models` de OpenRouter al formato del catálogo. */
export const mapOpenRouterModel = (model: OpenRouterApiModel): ModelDefinition => {
  const providerKey = getProviderKey(model.id);
  const supportedParameters = model.supported_parameters ?? [];
  const inputModalities = model.architecture?.input_modalities;

  const isReasoning =
    supportedParameters.includes('reasoning') ||
    model.id.includes('reasoning') ||
    model.id.includes('thinking') ||
    model.id.includes('-r1') ||
    model.id.startsWith('openai/o1') ||
    model.id.startsWith('openai/o3');

  const supportsImages =
    modalitiesInclude(inputModalities, 'image') ||
    modalitiesInclude(inputModalities, 'multimodal') ||
    modalitiesInclude(inputModalities, 'vision') ||
    model.id.includes('vision') ||
    model.id.includes('vl');

  const promptPrice = Number.parseFloat(model.pricing?.prompt ?? '');
  const completionPrice = Number.parseFloat(model.pricing?.completion ?? '');
  const hasPricing = Number.isFinite(promptPrice) && Number.isFinite(completionPrice);
  const inputPerMillion = hasPricing ? promptPrice * 1_000_000 : 0;
  const outputPerMillion = hasPricing ? completionPrice * 1_000_000 : 0;

  const tier: ModelTier =
    inputPerMillion > PREMIUM_INPUT_PRICE_PER_MILLION ||
    outputPerMillion > PREMIUM_OUTPUT_PRICE_PER_MILLION
      ? 'premium'
      : 'standard';

  const isFast =
    (hasPricing && inputPerMillion < FAST_INPUT_PRICE_PER_MILLION) ||
    ['flash', 'mini', 'lite', 'haiku', 'fast', 'speed'].some((hint) => model.id.includes(hint));

  const maxCompletionTokens = model.top_provider?.max_completion_tokens;

  return {
    id: model.id,
    name: model.name || model.id,
    iconKey: providerKey,
    displayProviderName: getDisplayProviderName(providerKey),
    tier,
    description:
      model.description || `Modelo ${model.name || model.id} disponible a través de OpenRouter.`,
    capabilities: {
      fast: isFast,
      vision: supportsImages,
      reasoning: isReasoning,
      effortControl: supportedParameters.includes('reasoning'),
      toolCalling: supportedParameters.includes('tools'),
      imageGeneration:
        modalitiesInclude(model.architecture?.output_modalities, 'image') ||
        model.id.includes('dall-e') ||
        model.id.includes('flux') ||
        model.id.includes('stable-diffusion'),
      pdfComprehension: model.context_length >= DOCUMENT_CONTEXT_THRESHOLD,
      thinking:
        supportedParameters.includes('thinking') ||
        model.id.includes('thinking') ||
        model.id.includes('-r1'),
      webSearch: true,
    },
    contextLength: model.context_length,
    ...(typeof maxCompletionTokens === 'number' && maxCompletionTokens > 0
      ? { maxTokens: maxCompletionTokens }
      : {}),
    ...(hasPricing ? { pricing: { input: inputPerMillion, output: outputPerMillion } } : {}),
  };
};

/** Filtra y mapea la respuesta del endpoint `/models` al formato del catálogo. */
export const mapOpenRouterModels = (models: readonly OpenRouterApiModel[]): ModelDefinition[] =>
  models.flatMap((model) =>
    openRouterModelSupportsTextInTextOut(model) ? [mapOpenRouterModel(model)] : []
  );
