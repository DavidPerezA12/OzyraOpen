import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ChatMessageBar from './index';
import type { ChatMessageBarProps } from './types';
import { t } from '../../../i18n';

const createCustomization = (
  overrides: Partial<ChatMessageBarProps['customization']> = {}
): ChatMessageBarProps['customization'] => ({
  isOpen: false,
  draft: '',
  setDraft: vi.fn(),
  isImproving: false,
  toggle: vi.fn(),
  close: vi.fn(),
  save: vi.fn(),
  improve: vi.fn(),
  ...overrides,
});

const createProps = (overrides: Partial<ChatMessageBarProps> = {}): ChatMessageBarProps => ({
  isDarkMode: false,
  isGenerating: false,
  hasActiveChat: true,
  composer: {
    inputValue: '',
    setInputValue: vi.fn(),
    uploadedImages: [],
    setUploadedImages: vi.fn(),
  },
  textareaRef: createRef<HTMLTextAreaElement>(),
  onSubmit: vi.fn(),
  onCancel: vi.fn(),
  modelPicker: {
    selectedModel: 'openai/gpt-5-chat',
    enabledModelIds: ['openai/gpt-5-chat'],
    onSelectModel: vi.fn(),
    onOpenSettings: vi.fn(),
  },
  customization: createCustomization(),
  ...overrides,
});

describe('ChatMessageBar', () => {
  it('opens chat customization from the composer when a chat is active', () => {
    const customization = createCustomization();

    render(<ChatMessageBar {...createProps({ customization })} />);

    fireEvent.click(screen.getByRole('button', { name: t('customizeChat') }));

    expect(customization.toggle).toHaveBeenCalledOnce();
  });

  it('does not open chat customization before a chat exists', () => {
    const customization = createCustomization();

    render(<ChatMessageBar {...createProps({ hasActiveChat: false, customization })} />);

    fireEvent.click(screen.getByRole('button', { name: t('customizeChatDisabled') }));

    expect(customization.toggle).not.toHaveBeenCalled();
  });
});
