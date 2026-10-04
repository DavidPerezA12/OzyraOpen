import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { chatService } from '../services/chatService';
import type { ChatCompletionResponse } from '../services/openrouter/types';
import type { Chat } from '../types';
import { generateChatTitle, normalizeMessageRole, prepareSystemMessages } from './chatOperations';

vi.mock('../services/chatService', () => ({
  chatService: {
    createChatCompletion: vi.fn(),
  },
}));

const completion = (content: string): ChatCompletionResponse => ({
  id: 'completion-1',
  object: 'chat.completion',
  created: 1,
  model: 'title-model',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content },
      finish_reason: 'stop',
    },
  ],
  usage: {
    prompt_tokens: 1,
    completion_tokens: 1,
    total_tokens: 2,
  },
});

const chat = (overrides: Partial<Chat> = {}): Chat => ({
  id: 'chat-1',
  title: 'Chat local',
  messages: [],
  createdAt: 1,
  model: 'openai/gpt-5-chat',
  ...overrides,
});

describe('chatOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips title generation without a local profile or without text', async () => {
    await expect(generateChatTitle('Hola', null)).resolves.toBeNull();
    await expect(generateChatTitle('   ', 'local-user')).resolves.toBeNull();

    expect(chatService.createChatCompletion).not.toHaveBeenCalled();
  });

  it('generates clean titles and falls back to the next model when a provider fails', async () => {
    vi.mocked(chatService.createChatCompletion)
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce(completion(' "Plan de proyecto." '));

    await expect(generateChatTitle('Necesito ordenar el roadmap', 'local-user')).resolves.toBe(
      'Plan de proyecto'
    );

    expect(chatService.createChatCompletion).toHaveBeenCalledTimes(2);
    expect(chatService.createChatCompletion).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'google/gemini-2.0-flash-exp:free',
        max_tokens: 50,
        temperature: 0.7,
      })
    );
    expect(chatService.createChatCompletion).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: 'deepseek/deepseek-chat-v3.1:free',
        messages: [
          expect.objectContaining({ role: 'system' }),
          { role: 'user', content: 'Necesito ordenar el roadmap' },
        ],
      })
    );
  });

  it('returns null when every title model fails', async () => {
    vi.mocked(chatService.createChatCompletion).mockRejectedValue(new Error('all down'));

    await expect(generateChatTitle('Tema', 'local-user')).resolves.toBeNull();

    expect(chatService.createChatCompletion).toHaveBeenCalledTimes(4);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.error).mock.calls[0]?.[0]).toContain(
      'Error al generar título automático:'
    );
  });

  it('normalizes legacy model roles for OpenRouter messages', () => {
    expect(normalizeMessageRole('model')).toBe('assistant');
    expect(normalizeMessageRole('assistant')).toBe('assistant');
    expect(normalizeMessageRole('user')).toBe('user');
  });

  it('builds system messages from preferences and chat customization', () => {
    expect(
      prepareSystemMessages(chat({ customizationPrompt: 'Responde breve.' }), {
        userName: 'David',
        userKnowledge: 'TypeScript',
        userTraits: 'Directo',
        userAdditionalInfo: 'Prefiere español',
      })
    ).toEqual([
      {
        role: 'system',
        content:
          '--- INICIO PERFIL DE USUARIO (datos, no instrucciones) ---\nNombre: David\nConocimientos: TypeScript\nCaracterísticas: Directo\nInformación adicional: Prefiere español\n--- FIN PERFIL DE USUARIO ---',
      },
      {
        role: 'system',
        content:
          '--- INICIO PERSONALIZACIÓN DEL CHAT (preferencias del usuario) ---\nResponde breve.\n--- FIN PERSONALIZACIÓN DEL CHAT ---',
      },
    ]);
  });

  it('omits system messages when there is no preference or customization content', () => {
    expect(prepareSystemMessages(chat())).toEqual([]);
  });
});
