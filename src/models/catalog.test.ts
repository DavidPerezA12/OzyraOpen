import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { getModelInfo, getOpenRouterApiModelId, modelHasCapability } from './catalog';
import { resolveModelIcon } from './icons';
import {
  mapOpenRouterModel,
  openRouterModelSupportsTextInTextOut,
  type OpenRouterApiModel,
} from './openRouterModels';

describe('model helpers', () => {
  it('removes reasoning suffix while preserving online routing', () => {
    expect(getOpenRouterApiModelId('anthropic/claude-sonnet-4.5-reasoning:online')).toBe(
      'anthropic/claude-sonnet-4.5:online'
    );
    expect(getOpenRouterApiModelId('z-ai/glm-4.6:reasoning:online')).toBe('z-ai/glm-4.6:online');
  });

  it('resolves UI model info and capabilities with online suffixes', () => {
    expect(getModelInfo('anthropic/claude-sonnet-4.5-reasoning:online')?.id).toBe(
      'anthropic/claude-sonnet-4.5-reasoning'
    );
    expect(modelHasCapability('anthropic/claude-sonnet-4.5-reasoning:online', 'reasoning')).toBe(
      true
    );
  });

  it('keeps only OpenRouter models that support text input and text output', () => {
    const model = (architecture: OpenRouterApiModel['architecture']): OpenRouterApiModel => ({
      id: 'provider/model',
      context_length: 8192,
      architecture,
    });

    expect(
      openRouterModelSupportsTextInTextOut(
        model({ input_modalities: ['text', 'image'], output_modalities: ['text'] })
      )
    ).toBe(true);
    expect(
      openRouterModelSupportsTextInTextOut(
        model({ input_modalities: ['text'], output_modalities: ['image'] })
      )
    ).toBe(false);
    expect(
      openRouterModelSupportsTextInTextOut(
        model({ input_modalities: ['audio'], output_modalities: ['text'] })
      )
    ).toBe(false);
    expect(openRouterModelSupportsTextInTextOut(model({ modality: 'text+image->text' }))).toBe(
      true
    );
  });

  it('assigns official SVGs to known providers without inventing unknown brands', () => {
    const createModel = (id: string): OpenRouterApiModel => ({
      id,
      context_length: 8192,
      architecture: {
        input_modalities: ['text'],
        output_modalities: ['text'],
      },
    });

    const deepSeekIcon = resolveModelIcon(
      mapOpenRouterModel(createModel('deepseek/deepseek-chat')).iconKey
    );
    const futureProviderIcon = resolveModelIcon(
      mapOpenRouterModel(createModel('future-provider/new-model')).iconKey
    );

    expect(typeof deepSeekIcon).toBe('function');

    const deepSeekMarkup = renderToStaticMarkup(
      React.createElement(deepSeekIcon as React.ElementType)
    );
    const futureProviderMarkup = renderToStaticMarkup(
      React.createElement(futureProviderIcon as React.ElementType)
    );

    expect(deepSeekMarkup).toContain('<img');
    expect(deepSeekMarkup).toContain('image/svg+xml');
    expect(futureProviderMarkup).toContain('<svg');
    expect(futureProviderMarkup).not.toContain('FP');
    expect(futureProviderMarkup).not.toContain('<text');
  });
});

describe('model catalog cache', () => {
  const freshCatalog = async () => {
    vi.resetModules();
    return import('./catalog');
  };

  it('reads the legacy cache format (capability aliases and icon names)', async () => {
    localStorage.setItem(
      'ozyra_openrouter_models_cache',
      JSON.stringify([
        {
          id: 'mistralai/mistral-large',
          name: 'Mistral Large',
          icon: 'mistral',
          provider: 'openrouter',
          displayProviderName: 'Mistral',
          tier: 'premium',
          description: 'Legacy',
          capabilities: { images: true, tools: true, files: true, reasoningLevels: true },
          maxTokens: 4096,
        },
        { id: 42, name: 'corrupt entry' },
      ])
    );
    localStorage.setItem(
      'ozyra_openrouter_models_cache_meta',
      JSON.stringify({ source: 'openrouter', syncedAt: 1000, count: 1 })
    );

    const { getModelCatalog, getModelInfo } = await freshCatalog();

    expect(getModelCatalog().models.map((model) => model.id)).toEqual(['mistralai/mistral-large']);
    expect(getModelInfo('mistralai/mistral-large')).toMatchObject({
      iconKey: 'mistral',
      maxTokens: 4096,
      capabilities: {
        vision: true,
        toolCalling: true,
        pdfComprehension: true,
        effortControl: true,
      },
    });
  });

  it('replaces the catalog immutably, persists it and notifies subscribers', async () => {
    const { getModelCatalog, replaceModelCatalog, subscribeToModelCatalog } = await freshCatalog();
    const before = getModelCatalog();
    const listener = vi.fn();
    subscribeToModelCatalog(listener);

    replaceModelCatalog(
      [
        mapOpenRouterModel({
          id: 'deepseek/deepseek-chat',
          context_length: 64000,
          top_provider: { max_completion_tokens: 8192 },
        }),
      ],
      5000
    );

    const after = getModelCatalog();
    expect(after).not.toBe(before);
    expect(after.meta).toEqual({ source: 'openrouter', syncedAt: 5000, count: 1 });
    expect(listener).toHaveBeenCalledOnce();
    const cached = JSON.parse(localStorage.getItem('ozyra_openrouter_models_cache') ?? '[]');
    expect(cached[0]).toMatchObject({ id: 'deepseek/deepseek-chat', iconKey: 'deepseek' });
    expect(cached[0]).not.toHaveProperty('icon');
  });

  it('ignores an empty sync instead of leaving the app without models', async () => {
    const { getModelCatalog, replaceModelCatalog } = await freshCatalog();
    const before = getModelCatalog();

    replaceModelCatalog([]);

    expect(getModelCatalog()).toBe(before);
  });

  it('only refreshes a synced catalog once it is older than a day', async () => {
    const { isModelCatalogStale, replaceModelCatalog, MODEL_CATALOG_MAX_AGE_MS } =
      await freshCatalog();
    expect(isModelCatalogStale()).toBe(false); // catálogo de reserva

    replaceModelCatalog(
      [mapOpenRouterModel({ id: 'openai/gpt-5', context_length: 400000 })],
      1_000
    );
    expect(isModelCatalogStale(1_000 + MODEL_CATALOG_MAX_AGE_MS)).toBe(false);
    expect(isModelCatalogStale(1_001 + MODEL_CATALOG_MAX_AGE_MS)).toBe(true);
  });
});
