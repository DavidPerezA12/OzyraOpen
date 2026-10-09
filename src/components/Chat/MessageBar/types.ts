import type React from 'react';
import type { ComposerState } from '../../../hooks/useChatGeneration';
import type { ChatCustomizationController } from '../../../hooks/useChatCustomization';
import type { ReasoningLevel, SubmitChatOptions } from '../../../services/chat/generationPipeline';
import type { UploadedImage } from '../../../types';

export type { ReasoningLevel, UploadedImage };
export type SubmitOptions = SubmitChatOptions;

export interface ModelPickerProps {
  readonly selectedModel: string;
  readonly enabledModelIds: readonly string[];
  readonly onSelectModel: (modelId: string) => void;
  readonly onOpenSettings: () => void;
}

export interface ChatMessageBarProps {
  readonly isDarkMode: boolean;
  /** Hay una respuesta generándose en el chat activo */
  readonly isGenerating: boolean;
  /** Existe un chat activo (la personalización requiere uno) */
  readonly hasActiveChat: boolean;
  readonly composer: ComposerState;
  readonly textareaRef: React.RefObject<HTMLTextAreaElement>;
  readonly onSubmit: (e: React.FormEvent, options?: SubmitOptions) => void;
  readonly onCancel: () => void;
  readonly modelPicker: ModelPickerProps;
  readonly customization: ChatCustomizationController;
}
