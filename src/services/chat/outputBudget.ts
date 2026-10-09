import { GENERATION_CONFIG } from '../../config/constants';
import type { ChatCompletionRequest, ReasoningLevel } from '../openrouter/types';

export interface OutputBudget {
  /** Valor de `max_tokens` (razonamiento + respuesta visible) */
  readonly maxTokens: number;
  readonly reasoning?: ChatCompletionRequest['reasoning'];
}

/**
 * Familias cuyo razonamiento se controla con un presupuesto explícito de
 * tokens (`reasoning.max_tokens`). El resto (OpenAI, xAI…) usa `effort`.
 * Con `effort`, OpenRouter reparte `max_tokens` por porcentaje (p. ej. 80 %
 * para `high`), lo que dejaría muy poco margen a la respuesta visible.
 */
const TOKEN_BUDGET_REASONING_MODEL = /^~?(anthropic|google|qwen)\//;

export const usesReasoningTokenBudget = (apiModelId: string): boolean =>
  TOKEN_BUDGET_REASONING_MODEL.test(apiModelId);

/**
 * Calcula `max_tokens` y la configuración de razonamiento de una petición.
 *
 * - Sin razonamiento: `OUTPUT_TOKENS` para la respuesta.
 * - Con razonamiento: `OUTPUT_TOKENS + presupuesto`, porque en casi todos los
 *   proveedores `max_tokens` cubre ambas cosas. Antes se enviaba un
 *   `max_tokens` fijo de 2048, inferior al propio presupuesto de razonamiento.
 * - Si el modelo declara un máximo de salida menor, se recorta y el
 *   presupuesto se reparte para que la respuesta conserve al menos la mitad.
 *   Anthropic exige `max_tokens` estrictamente mayor que el presupuesto.
 */
export const getOutputBudget = ({
  apiModelId,
  supportsReasoning,
  reasoningLevel,
  modelMaxOutputTokens,
}: {
  readonly apiModelId: string;
  readonly supportsReasoning: boolean;
  readonly reasoningLevel?: ReasoningLevel;
  readonly modelMaxOutputTokens?: number;
}): OutputBudget => {
  const outputCap =
    modelMaxOutputTokens && modelMaxOutputTokens > 0 ? modelMaxOutputTokens : Infinity;

  if (!supportsReasoning) {
    return { maxTokens: Math.min(GENERATION_CONFIG.OUTPUT_TOKENS, outputCap) };
  }

  const level = reasoningLevel ?? 'medium';
  const requestedBudget = GENERATION_CONFIG.REASONING_BUDGET_TOKENS[level];
  const maxTokens = Math.min(GENERATION_CONFIG.OUTPUT_TOKENS + requestedBudget, outputCap);

  if (!usesReasoningTokenBudget(apiModelId)) {
    return { maxTokens, reasoning: { effort: level } };
  }

  const reservedForAnswer = Math.min(GENERATION_CONFIG.OUTPUT_TOKENS, Math.floor(maxTokens / 2));
  const budget = Math.min(requestedBudget, maxTokens - reservedForAnswer);
  if (budget < GENERATION_CONFIG.MIN_REASONING_BUDGET_TOKENS) {
    // Salida demasiado pequeña para un presupuesto válido: OpenRouter
    // deriva el presupuesto a partir del nivel.
    return { maxTokens, reasoning: { effort: level } };
  }

  return { maxTokens, reasoning: { max_tokens: budget } };
};
