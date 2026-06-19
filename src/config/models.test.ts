import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  getModelInfo,
  getOpenRouterApiModelId,
  mapOpenRouterModelToInfo,
  modelHasCapability,
  openRouterModelSupportsTextInTextOut,
  type OpenRouterApiModel,
} from './models';

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

    const deepSeekIcon = mapOpenRouterModelToInfo(createModel('deepseek/deepseek-chat')).icon;
    const futureProviderIcon = mapOpenRouterModelToInfo(
      createModel('future-provider/new-model')
    ).icon;

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
