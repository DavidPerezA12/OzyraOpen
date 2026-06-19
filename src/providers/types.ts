import type { ElementType } from 'react';
import type { ModelPricing, ModelProvider, ModelTier } from '../types';

interface ProviderModelDefinition {
  readonly id: string;
  readonly name: string;
  readonly icon?: ElementType | string;
  readonly provider?: ModelProvider;
  readonly displayProviderName: string;
  readonly description: string;
  readonly tier?: ModelTier;
  readonly isReasoning?: boolean;
  readonly supportsReasoningLevels?: boolean; // If true, model supports low/medium/high reasoning
  readonly supportsThinking?: boolean;
  readonly isFast?: boolean;
  readonly supportsImages?: boolean;
  readonly supportsVision?: boolean;
  readonly supportsFileProcessing?: boolean;
  readonly supportsPdfComprehension?: boolean;
  readonly supportsWebSearch?: boolean;
  readonly supportsTools?: boolean;
  readonly supportsToolCalling?: boolean;
  readonly supportsImageGeneration?: boolean;
  readonly isRecommended?: boolean;
  readonly isFeatured?: boolean;
  readonly isSpecial?: boolean;
  readonly isNew?: boolean;
  readonly contextLength?: number;
  readonly maxTokens?: number;
  readonly pricing?: ModelPricing;
}

export type ProviderModelList = readonly ProviderModelDefinition[];
