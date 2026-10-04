import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';

import { STORAGE_KEYS } from '../config/constants';
import { chatService } from '../services/chatService';
import { runAssistantStream } from '../services/chat/assistantStreamRunner';
import type { Chat, UploadedImage } from '../types';
import { useChatGeneration, type UseChatGenerationParams } from './useChatGeneration';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
  },
}));

vi.mock('../services/chatService', () => ({
  chatService: {
    createChatCompletion: vi.fn(),
    createChatCompletionStream: vi.fn(),
  },
}));

vi.mock('../services/chat/assistantStreamRunner', async () => {
  const actual = await vi.importActual<typeof import('../services/chat/assistantStreamRunner')>(
    '../services/chat/assistantStreamRunner'
  );

  return {
    ...actual,
    runAssistantStream: vi.fn(),
  };
});

const storage = new Map<string, string>();

const setMockLocalStorage = () => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });
};

const Harness = (props: UseChatGenerationParams) => {
  const generation = useChatGeneration(props);

  return (
    <form onSubmit={generation.handleSubmit}>
      <button type="submit">Enviar</button>
    </form>
  );
};

const noopDispatch = vi.fn() as unknown as Dispatch<SetStateAction<UploadedImage[]>>;

const createParams = (
  overrides: Partial<UseChatGenerationParams> = {}
): UseChatGenerationParams => ({
  userId: 'local-user',
  chats: [],
  setChats: vi.fn() as unknown as Dispatch<SetStateAction<Chat[]>>,
  currentChat: null,
  setCurrentChat: vi.fn() as unknown as Dispatch<SetStateAction<Chat | null>>,
  selectedModel: 'openai/gpt-5-chat',
  inputValue: 'Hola',
  setInputValue: vi.fn(),
  uploadedImages: [],
  setUploadedImages: noopDispatch,
  preferences: {
    userName: '',
    userKnowledge: '',
    userTraits: '',
    userAdditionalInfo: '',
  },
  incrementUsage: vi.fn(),
  ...overrides,
});

describe('useChatGeneration', () => {
  beforeEach(() => {
    storage.clear();
    setMockLocalStorage();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not create chat state or call OpenRouter when the API key is missing', () => {
    const setChats = vi.fn() as unknown as Dispatch<SetStateAction<Chat[]>>;
    const setCurrentChat = vi.fn() as unknown as Dispatch<SetStateAction<Chat | null>>;
    const setInputValue = vi.fn();

    render(
      <Harness
        {...createParams({
          setChats,
          setCurrentChat,
          setInputValue,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    expect(setChats).not.toHaveBeenCalled();
    expect(setCurrentChat).not.toHaveBeenCalled();
    expect(setInputValue).not.toHaveBeenCalled();
    expect(chatService.createChatCompletionStream).not.toHaveBeenCalled();
    expect(runAssistantStream).not.toHaveBeenCalled();
  });

  it('creates a chat, streams an assistant draft and stores the final assistant message', async () => {
    storage.set(STORAGE_KEYS.OPENROUTER_API_KEY, 'sk-or-v1-local');
    const ids: `${string}-${string}-${string}-${string}-${string}`[] = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000003',
    ];
    vi.spyOn(crypto, 'randomUUID').mockImplementation(
      () => ids.shift() ?? '00000000-0000-4000-8000-000000000099'
    );

    vi.mocked(runAssistantStream).mockImplementation(async ({ onDraftUpdate }) => {
      onDraftUpdate({ partialResponse: 'Respuesta parcial' });
      return {
        id: '00000000-0000-4000-8000-000000000003',
        role: 'assistant',
        content: 'Respuesta final',
        timestamp: 2,
        model: 'openai/gpt-5-chat',
        thinkingContent: 'Plan final',
      };
    });

    let chatsState: Chat[] = [];
    let currentChatState: Chat | null = null;
    const setChats = vi.fn((action: SetStateAction<Chat[]>) => {
      chatsState = typeof action === 'function' ? action(chatsState) : action;
    }) as Dispatch<SetStateAction<Chat[]>>;
    const setCurrentChat = vi.fn((action: SetStateAction<Chat | null>) => {
      currentChatState = typeof action === 'function' ? action(currentChatState) : action;
    }) as Dispatch<SetStateAction<Chat | null>>;
    const setInputValue = vi.fn();
    const setUploadedImages = vi.fn() as unknown as Dispatch<SetStateAction<UploadedImage[]>>;
    const incrementUsage = vi.fn().mockResolvedValue(undefined);

    render(
      <Harness
        {...createParams({
          userId: null,
          setChats,
          setCurrentChat,
          setInputValue,
          setUploadedImages,
          incrementUsage,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));

    await waitFor(() => expect(runAssistantStream).toHaveBeenCalled());
    await waitFor(() => expect(incrementUsage).toHaveBeenCalledWith('premium', null));

    expect(setInputValue).toHaveBeenCalledWith('');
    expect(setUploadedImages).toHaveBeenCalledWith([]);
    expect(currentChatState).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      model: 'openai/gpt-5-chat',
      messages: [
        { id: '00000000-0000-4000-8000-000000000002', role: 'user', content: 'Hola' },
        {
          id: '00000000-0000-4000-8000-000000000003',
          role: 'assistant',
          content: 'Respuesta final',
          thinkingContent: 'Plan final',
        },
      ],
    });
    expect(chatsState[0]).toEqual(currentChatState);
  });
});
