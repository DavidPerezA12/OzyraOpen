import { SiAnthropic } from 'react-icons/si';
import type { ProviderModelList } from './types';

// OpenRouter implementation - Only verified models
export const anthropicModels: ProviderModelList = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    icon: SiAnthropic,
    provider: 'openrouter',
    displayProviderName: 'Anthropic',
    isReasoning: false,
    tier: 'premium',
    supportsImages: true,
    supportsFileProcessing: true,
    supportsTools: true,
    description:
      'Modelo Claude Sonnet 4.5 optimizado para conversación y análisis sin razonamiento extendido.',
    isFeatured: true,
  },
  {
    id: 'anthropic/claude-sonnet-4.5-reasoning',
    name: 'Claude Sonnet 4.5 Reasoning',
    icon: SiAnthropic,
    provider: 'openrouter',
    displayProviderName: 'Anthropic',
    isReasoning: true,
    supportsReasoningLevels: true,
    tier: 'premium',
    supportsImages: true,
    supportsFileProcessing: true,
    supportsTools: true,
    description:
      'Claude Sonnet 4.5 con capacidades avanzadas de razonamiento. Soporta niveles de esfuerzo bajo, medio y alto.',
    isFeatured: true,
  },
];
