import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Dispatch, SetStateAction } from 'react';

import { chatService } from '../services/chatService';
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
  });
});
