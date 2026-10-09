import type { ModelCapabilities, ModelDefinition } from '../types';

const capabilities = (enabled: Partial<ModelCapabilities>): ModelCapabilities => ({
  fast: false,
  vision: false,
  reasoning: false,
  effortControl: false,
  toolCalling: false,
  imageGeneration: false,
  pdfComprehension: false,
  thinking: false,
  webSearch: false,
  ...enabled,
});

/**
 * Catálogo de reserva mientras no se haya sincronizado con OpenRouter.
 *
 * Las variantes `-reasoning` / `:reasoning` son ids de la app: se envían a
 * OpenRouter como el modelo base con razonamiento activado (ver
 * `getOpenRouterApiModelId`).
 */
export const DEFAULT_MODELS: readonly ModelDefinition[] = [
  {
    id: 'openai/gpt-5-chat',
    name: 'GPT-5 Chat',
    iconKey: 'openai',
    displayProviderName: 'OpenAI',
    tier: 'premium',
    description:
      'Modelo GPT-5 optimizado para conversación natural y análisis multimodal. Actualmente no soporta llamadas a herramientas.',
    capabilities: capabilities({ vision: true, pdfComprehension: true }),
    isFeatured: true,
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5 Reasoning',
    iconKey: 'openai',
    displayProviderName: 'OpenAI',
    tier: 'premium',
    description:
      'Modelo GPT-5 con capacidades avanzadas de razonamiento. Soporta niveles de esfuerzo bajo, medio y alto.',
    capabilities: capabilities({
      vision: true,
      pdfComprehension: true,
      toolCalling: true,
      reasoning: true,
      effortControl: true,
    }),
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    iconKey: 'anthropic',
    displayProviderName: 'Anthropic',
    tier: 'premium',
    description:
      'Modelo Claude Sonnet 4.5 optimizado para conversación y análisis sin razonamiento extendido.',
    capabilities: capabilities({ vision: true, pdfComprehension: true, toolCalling: true }),
    isFeatured: true,
  },
  {
    id: 'anthropic/claude-sonnet-4.5-reasoning',
    name: 'Claude Sonnet 4.5 Reasoning',
    iconKey: 'anthropic',
    displayProviderName: 'Anthropic',
    tier: 'premium',
    description:
      'Claude Sonnet 4.5 con capacidades avanzadas de razonamiento. Soporta niveles de esfuerzo bajo, medio y alto.',
    capabilities: capabilities({
      vision: true,
      pdfComprehension: true,
      toolCalling: true,
      reasoning: true,
      effortControl: true,
    }),
    isFeatured: true,
  },
  {
    id: 'z-ai/glm-4.6',
    name: 'GLM-4.6',
    iconKey: '/icon/glm.svg',
    displayProviderName: 'GLM',
    tier: 'premium',
    description:
      'Modelo GLM-4 optimizado para tareas complejas. Pensado para generar código, razonar y trabajar con prompts largos.',
    capabilities: capabilities({ pdfComprehension: true, toolCalling: true }),
  },
  {
    id: 'z-ai/glm-4.6:reasoning',
    name: 'GLM-4.6 Reasoning',
    iconKey: '/icon/glm.svg',
    displayProviderName: 'GLM',
    tier: 'premium',
    description: 'GLM 4 con modo razonador extendido. Permite razonamiento mucho más profundo.',
    capabilities: capabilities({ pdfComprehension: true, toolCalling: true, reasoning: true }),
  },
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    iconKey: 'google',
    displayProviderName: 'Google',
    tier: 'standard',
    description:
      'Versión experimental con capacidades avanzadas de búsqueda web y análisis multimodal. Ofrece un rendimiento sólido [free]',
    capabilities: capabilities({ vision: true, pdfComprehension: true, toolCalling: true }),
    isRecommended: true,
    isFeatured: true,
  },
];
