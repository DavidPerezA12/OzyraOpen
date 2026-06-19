import { SiGooglegemini } from 'react-icons/si';
import type { ProviderModelList } from './types';

export const googleModels: ProviderModelList = [
  {
    id: 'google/gemini-2.0-flash-exp:free',
    name: 'Gemini 2.0 Flash',
    icon: SiGooglegemini,
    provider: 'openrouter',
    displayProviderName: 'Google',
    isReasoning: false,
    tier: 'standard',
    supportsImages: true,
    supportsFileProcessing: true,
    supportsTools: true,
    description:
      'Versión experimental con capacidades avanzadas de búsqueda web y análisis multimodal. Ofrece un rendimiento sólido [free]',
    isRecommended: true,
    isFeatured: true,
  },
];
