import type { ProviderModelList } from './types';

// OpenRouter implementation - Only verified models
export const glmModels: ProviderModelList = [
  {
    id: 'z-ai/glm-4.6',
    name: 'GLM-4.6',
    icon: '/icon/glm.svg',
    provider: 'openrouter',
    displayProviderName: 'GLM',
    isReasoning: false,
    tier: 'premium',
    supportsImages: false,
    supportsFileProcessing: true,
    supportsTools: true,
    description:
      'Modelo GLM-4 optimizado para tareas complejas. Pensado para generar código, razonar y trabajar con prompts largos.',
  },
  {
    id: 'z-ai/glm-4.6:reasoning',
    name: 'GLM-4.6 Reasoning',
    icon: '/icon/glm.svg',
    provider: 'openrouter',
    displayProviderName: 'GLM',
    isReasoning: true,
    supportsReasoningLevels: false, // Based on requirements, GLM doesn't have low/medium/high levels
    tier: 'premium',
    supportsImages: false,
    supportsFileProcessing: true,
    supportsTools: true,
    description: 'GLM 4 con modo razonador extendido. Permite razonamiento mucho más profundo.',
  },
];
