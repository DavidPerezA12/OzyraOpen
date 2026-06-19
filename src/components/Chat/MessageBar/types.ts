import type React from 'react';
import type { Chat } from '../../../types';

export type ReasoningLevel = 'low' | 'medium' | 'high';

export interface SubmitOptions {
  readonly useWebSearch?: boolean;
  readonly reasoningLevel?: ReasoningLevel;
}

export interface UploadedImage {
  readonly url: string;
  readonly contentType: string;
  readonly data?: string;
}

interface ChatMessageBarUiState {
  readonly isDarkMode: boolean;
  readonly isLoading: boolean;
  readonly isModelDropdownOpen: boolean;
  readonly showChatCustomization: boolean;
  readonly isImprovingChatCustomization: boolean;
}

export interface ChatMessageBarProps {
  readonly uiState: ChatMessageBarUiState;
  readonly inputValue: string;
  readonly setInputValue: (value: string) => void;
  readonly handleSubmit: (e: React.FormEvent, options?: SubmitOptions) => void;
  readonly currentChat: Chat | null;
  readonly selectedModel: string;
  readonly setIsModelDropdownOpen: (isOpen: boolean) => void;
  readonly modelDropdownRef: React.RefObject<HTMLDivElement>;
  readonly modelSearchQuery: string;
  readonly setModelSearchQuery: (query: string) => void;
  readonly enabledModelIds: readonly string[];
  readonly handleModelSelect: (modelId: string) => void;
  readonly setShowSettings: (show: boolean) => void;
  readonly setShowChatCustomization: (show: boolean) => void;
  readonly currentChatCustomizationInput: string;
  readonly setCurrentChatCustomizationInput: (input: string) => void;
  readonly toggleChatCustomizationPopup: () => void;
  readonly handleSaveChatCustomization: () => void;
  readonly handleImproveChatCustomization: () => void;
  readonly textareaRef: React.RefObject<HTMLTextAreaElement>;
  readonly cancelGeneration?: () => void;
  readonly uploadedImages: readonly UploadedImage[];
  readonly setUploadedImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
}
