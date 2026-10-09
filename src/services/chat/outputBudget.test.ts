import { describe, expect, it } from 'vitest';
import { getOutputBudget, usesReasoningTokenBudget } from './outputBudget';

describe('getOutputBudget', () => {
  it('reserves the visible output budget for non-reasoning models', () => {
    expect(getOutputBudget({ apiModelId: 'openai/gpt-5-chat', supportsReasoning: false })).toEqual({
      maxTokens: 8192,
    });
  });

  it('adds the reasoning budget on top of the visible output', () => {
    expect(
      getOutputBudget({
        apiModelId: 'anthropic/claude-sonnet-4.5',
        supportsReasoning: true,
        reasoningLevel: 'medium',
      })
    ).toEqual({ maxTokens: 16384, reasoning: { max_tokens: 8192 } });
  });

  it('uses effort for models that do not take an explicit token budget', () => {
    expect(
      getOutputBudget({
        apiModelId: 'openai/gpt-5',
        supportsReasoning: true,
        reasoningLevel: 'high',
      })
    ).toEqual({ maxTokens: 8192 + 16384, reasoning: { effort: 'high' } });
  });

  it('defaults to the medium level when the model has no level selector', () => {
    expect(
      getOutputBudget({ apiModelId: 'deepseek/deepseek-r1', supportsReasoning: true })
    ).toEqual({ maxTokens: 16384, reasoning: { effort: 'medium' } });
  });

  it('splits a capped output so the answer keeps half and max_tokens exceeds the budget', () => {
    const budget = getOutputBudget({
      apiModelId: 'anthropic/claude-3.7-sonnet',
      supportsReasoning: true,
      reasoningLevel: 'high',
      modelMaxOutputTokens: 8192,
    });
    expect(budget).toEqual({ maxTokens: 8192, reasoning: { max_tokens: 4096 } });
    expect(budget.maxTokens).toBeGreaterThan(budget.reasoning?.max_tokens ?? 0);
  });

  it('falls back to effort when the output cap cannot fit a valid budget', () => {
    expect(
      getOutputBudget({
        apiModelId: 'anthropic/claude-3-haiku',
        supportsReasoning: true,
        reasoningLevel: 'low',
        modelMaxOutputTokens: 1500,
      })
    ).toEqual({ maxTokens: 1500, reasoning: { effort: 'low' } });
  });

  it('caps non-reasoning output to the model maximum', () => {
    expect(
      getOutputBudget({
        apiModelId: 'meta-llama/llama-3-8b',
        supportsReasoning: false,
        modelMaxOutputTokens: 4096,
      })
    ).toEqual({ maxTokens: 4096 });
  });

  it('detects token-budget reasoning families', () => {
    expect(usesReasoningTokenBudget('anthropic/claude-opus-4')).toBe(true);
    expect(usesReasoningTokenBudget('~anthropic/claude-sonnet-latest')).toBe(true);
    expect(usesReasoningTokenBudget('google/gemini-2.5-pro')).toBe(true);
    expect(usesReasoningTokenBudget('openai/o3')).toBe(false);
    expect(usesReasoningTokenBudget('x-ai/grok-4')).toBe(false);
  });
});
