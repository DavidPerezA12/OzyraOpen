import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Chat } from '../../../types';
import ChatMessageBar from './index';
import type { ChatMessageBarProps } from './types';

const activeChat: Chat = {
  id: 'chat-1',
  title: 'Chat activo',
  messages: [],
  createdAt: Date.now(),
  model: 'openai/gpt-5-chat',
  isPersisted: true,
};

const createProps = (overrides: Partial<ChatMessageBarProps> = {}): ChatMessageBarProps => ({
  uiState: {
    isDarkMode: false,
    isLoading: false,
    isModelDropdownOpen: false,
    showChatCustomization: false,
    isImprovingChatCustomization: false,
  },
  inputValue: '',
  setInputValue: vi.fn(),
  handleSubmit: vi.fn(),
  currentChat: activeChat,
  selectedModel: 'openai/gpt-5-chat',
  setIsModelDropdownOpen: vi.fn(),
  modelDropdownRef: createRef<HTMLDivElement>(),
  modelSearchQuery: '',
  setModelSearchQuery: vi.fn(),
  enabledModelIds: ['openai/gpt-5-chat'],
  handleModelSelect: vi.fn(),
  setShowSettings: vi.fn(),
  setShowChatCustomization: vi.fn(),
  currentChatCustomizationInput: '',
  setCurrentChatCustomizationInput: vi.fn(),
  toggleChatCustomizationPopup: vi.fn(),
  handleSaveChatCustomization: vi.fn(),
  handleImproveChatCustomization: vi.fn(),
  textareaRef: createRef<HTMLTextAreaElement>(),
  cancelGeneration: vi.fn(),
  uploadedImages: [],
  setUploadedImages: vi.fn() as unknown as ChatMessageBarProps['setUploadedImages'],
  ...overrides,
});

describe('ChatMessageBar', () => {
  it('opens chat customization from the composer when a chat is active', () => {
    const toggleChatCustomizationPopup = vi.fn();

    render(
      <ChatMessageBar
        {...createProps({
          toggleChatCustomizationPopup,
        })}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Personalizar esta conversación' }));

    expect(toggleChatCustomizationPopup).toHaveBeenCalledOnce();
  });

  it('does not open chat customization before a chat exists', () => {
    const toggleChatCustomizationPopup = vi.fn();

    render(
      <ChatMessageBar
        {...createProps({
          currentChat: null,
          toggleChatCustomizationPopup,
        })}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Crea una conversación antes de personalizarla' })
    );

    expect(toggleChatCustomizationPopup).not.toHaveBeenCalled();
  });
});
