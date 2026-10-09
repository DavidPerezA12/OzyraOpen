import { act, renderHook, waitFor } from '@testing-library/react';
import type { FormEvent } from 'react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { STORAGE_KEYS } from '../config/constants';
import { t } from '../i18n';
import {
  runAssistantStream,
  type RunAssistantStreamParams,
} from '../services/chat/assistantStreamRunner';
import { createChatStore, type ChatStore } from '../state/chatStore';
import type { Chat, Message } from '../types';
import { getMessages } from '../utils/db';
import { useChatGeneration, type ComposerState } from './useChatGeneration';

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('../services/chatService', () => ({
  chatService: {
    createChatCompletion: vi.fn().mockRejectedValue(new Error('sin títulos en tests')),
    createChatCompletionStream: vi.fn(),
  },
}));

vi.mock('../services/chat/assistantStreamRunner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/chat/assistantStreamRunner')>()),
  runAssistantStream: vi.fn(),
}));

const MODEL = 'openai/gpt-5-chat';
const submitEvent = { preventDefault: vi.fn() } as unknown as FormEvent;

const createComposer = (inputValue = 'Hola'): ComposerState => ({
  inputValue,
  setInputValue: vi.fn(),
  uploadedImages: [],
  setUploadedImages: vi.fn(),
});

const renderGeneration = (store: ChatStore, composer: ComposerState = createComposer()) =>
  renderHook(
    (props: { composer: ComposerState }) =>
      useChatGeneration({
        store,
        selectedModel: MODEL,
        composer: props.composer,
        preferences: { name: '', knowledge: '', traits: '', additionalInfo: '' },
      }),
    { initialProps: { composer } }
  );

const finalMessage = (params: RunAssistantStreamParams, content: string): Message => ({
  id: params.assistantMessageId,
  role: 'assistant',
  content,
  timestamp: Date.now(),
  model: params.submittedModel,
});

/** Stream controlable desde el test: permite cancelar a mitad de respuesta. */
const deferredStream = () => {
  let resolveStream!: () => void;
  let params!: RunAssistantStreamParams;
  vi.mocked(runAssistantStream).mockImplementation(async (streamParams) => {
    params = streamParams;
    streamParams.onDraftUpdate({ partialResponse: 'Respuesta parc' });
    await new Promise<void>((resolve) => {
      resolveStream = resolve;
      streamParams.signal.addEventListener('abort', () => resolve());
    });
    if (streamParams.signal.aborted) {
      throw new DOMException('aborted', 'AbortError');
    }
    return { message: finalMessage(streamParams, 'Respuesta completa'), finishReason: 'stop' };
  });
  return {
    get params() {
      return params;
    },
    finish: () => resolveStream(),
  };
};

const existingChat = (messages: Message[]): Chat => ({
  id: 'chat-1',
  title: 'Chat',
  messages,
  createdAt: 1,
  model: MODEL,
  isPersisted: false,
});

describe('useChatGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
  });

  it('does nothing and warns when the OpenRouter key is missing', async () => {
    localStorage.removeItem(STORAGE_KEYS.OPENROUTER_API_KEY);
    const store = createChatStore();
    const { result } = renderGeneration(store);

    await act(() => result.current.handleSubmit(submitEvent));

    expect(store.getState().chats).toEqual([]);
    expect(runAssistantStream).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(t('missingOpenRouterKey'));
  });

  it('creates and selects a chat, streams the draft and persists both messages', async () => {
    vi.mocked(runAssistantStream).mockImplementation(async (params) => {
      params.onDraftUpdate({ partialResponse: 'Respuesta parcial' });
      return { message: finalMessage(params, 'Respuesta final'), finishReason: 'stop' };
    });
    const store = createChatStore();
    const composer = createComposer();
    const { result } = renderGeneration(store, composer);

    await act(() => result.current.handleSubmit(submitEvent, { useWebSearch: false }));

    const chat = store.getCurrentChat();
    expect(chat).toMatchObject({ isPersisted: true, model: MODEL });
    expect(chat?.messages.map((message) => [message.role, message.content])).toEqual([
      ['user', 'Hola'],
      ['assistant', 'Respuesta final'],
    ]);
    expect(composer.setInputValue).toHaveBeenCalledWith('');
    expect(composer.setUploadedImages).toHaveBeenCalledWith([]);
    expect(result.current.generatingChatIds).toEqual([]);
    expect((await getMessages(chat?.id ?? '')).map((message) => message.content)).toEqual([
      'Hola',
      'Respuesta final',
    ]);

    // La petición usa el id del chat como sesión de prompt caching.
    expect(vi.mocked(runAssistantStream).mock.calls[0]?.[0].streamRequest.session_id).toBe(
      chat?.id
    );
  });

  it('marks only the in-flight draft as interrupted when cancelled', async () => {
    const stream = deferredStream();
    const store = createChatStore([
      existingChat([
        { id: 'u0', role: 'user', content: 'Antes', timestamp: 0 },
        { id: 'a0', role: 'assistant', content: 'Respuesta anterior', timestamp: 0 },
      ]),
    ]);
    store.selectChat('chat-1');
    const { result } = renderGeneration(store);

    let submission!: Promise<void>;
    act(() => {
      submission = result.current.handleSubmit(submitEvent);
    });
    await waitFor(() => expect(result.current.generatingChatIds).toEqual(['chat-1']));
    await waitFor(() => expect(stream.params).toBeDefined());

    act(() => result.current.cancelGeneration('chat-1'));
    await act(() => submission);

    const messages = store.getChat('chat-1')?.messages ?? [];
    expect(messages.find((message) => message.id === 'a0')?.content).toBe('Respuesta anterior');
    expect(messages[messages.length - 1]?.content).toMatch(/^Respuesta parc\n\n_\(/);
    expect(result.current.generatingChatIds).toEqual([]);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('treats submitting while generating as stop', async () => {
    const stream = deferredStream();
    const store = createChatStore([existingChat([])]);
    store.selectChat('chat-1');
    const { result } = renderGeneration(store);

    let first!: Promise<void>;
    act(() => {
      first = result.current.handleSubmit(submitEvent);
    });
    await waitFor(() => expect(stream.params).toBeDefined());

    await act(() => result.current.handleSubmit(submitEvent));
    await act(() => first);

    expect(runAssistantStream).toHaveBeenCalledTimes(1);
    expect(stream.params.signal.aborted).toBe(true);
  });

  it('regenerates without duplicating the user message', async () => {
    vi.mocked(runAssistantStream).mockImplementation(async (params) => ({
      message: finalMessage(params, 'Nueva respuesta'),
      finishReason: 'stop',
    }));
    const store = createChatStore([
      existingChat([
        { id: 'u1', role: 'user', content: 'Pregunta', timestamp: 1 },
        { id: 'a1', role: 'assistant', content: 'Vieja respuesta', timestamp: 2 },
      ]),
    ]);
    store.selectChat('chat-1');
    const { result } = renderGeneration(store);

    await act(() => result.current.regenerateResponse('a1'));

    expect(
      store.getChat('chat-1')?.messages.map((message) => [message.id, message.content])
    ).toEqual([
      ['u1', 'Pregunta'],
      [expect.any(String), 'Nueva respuesta'],
    ]);
    const request = vi.mocked(runAssistantStream).mock.calls[0]?.[0].streamRequest;
    expect(request?.messages.filter((message) => message.role === 'user')).toHaveLength(1);
  });

  it('removes the empty draft and shows the cause when the request fails', async () => {
    vi.mocked(runAssistantStream).mockRejectedValue(new Error('Clave inválida'));
    const store = createChatStore([existingChat([])]);
    store.selectChat('chat-1');
    const { result } = renderGeneration(store);

    await act(() => result.current.handleSubmit(submitEvent));

    expect(store.getChat('chat-1')?.messages.map((message) => message.role)).toEqual(['user']);
    expect(toast.error).toHaveBeenCalledWith('Clave inválida', { id: 'send-error-chat-1' });
  });

  it('warns when the response was cut by the token limit', async () => {
    vi.mocked(runAssistantStream).mockImplementation(async (params) => ({
      message: finalMessage(params, 'Respuesta a medias'),
      finishReason: 'length',
    }));
    const store = createChatStore([existingChat([])]);
    store.selectChat('chat-1');
    const { result } = renderGeneration(store);

    await act(() => result.current.handleSubmit(submitEvent));

    expect(toast.error).toHaveBeenCalledWith(t('responseTruncated'), {
      id: 'truncated-chat-1',
    });
  });
});
