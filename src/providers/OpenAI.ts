import { SiOpenai } from 'react-icons/si';
import type { ProviderModelList } from './types';

// OpenRouter implementation - Only verified models
export const openAIModels: ProviderModelList = [
  {
    id: 'openai/gpt-5-chat',
    name: 'GPT-5 Chat',
    icon: SiOpenai,
    provider: 'openrouter',
    displayProviderName: 'OpenAI',
    isReasoning: false,
    tier: 'premium',
    supportsImages: true,
    supportsFileProcessing: true,
    supportsTools: false,
    description:
      'Modelo GPT-5 optimizado para conversación natural y análisis multimodal. Actualmente no soporta llamadas a herramientas.',
    isFeatured: true,
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5 Reasoning',
    icon: SiOpenai,
    provider: 'openrouter',
    displayProviderName: 'OpenAI',
    isReasoning: true,
    supportsReasoningLevels: true,
    tier: 'premium',
    supportsImages: true,
    supportsFileProcessing: true,
    supportsTools: true,
    description:
      'Modelo GPT-5 con capacidades avanzadas de razonamiento. Soporta niveles de esfuerzo bajo, medio y alto.',
    isFeatured: false,
  },
];
