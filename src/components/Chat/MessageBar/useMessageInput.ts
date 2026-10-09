import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { ReasoningLevel, SubmitOptions, UploadedImage } from './types';

const MAX_TEXTAREA_HEIGHT = 200;

interface UseMessageInputOptions {
  readonly inputValue: string;
  readonly setInputValue: (value: string) => void;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
  readonly isLoading: boolean;
  readonly uploadedImages: readonly UploadedImage[];
  readonly handleSubmit: (e: FormEvent, options?: SubmitOptions) => void;
  readonly isWebSearchEnabled: boolean;
  readonly modelSupportsReasoningLevels: boolean;
  readonly reasoningLevel: ReasoningLevel;
}

export const useMessageInput = ({
  inputValue,
  setInputValue,
  textareaRef,
  isLoading,
  uploadedImages,
  handleSubmit,
  isWebSearchEnabled,
  modelSupportsReasoningLevels,
  reasoningLevel,
}: UseMessageInputOptions) => {
  const [isComposing, setIsComposing] = useState(false);

  const canSubmit = inputValue.trim().length > 0 || uploadedImages.length > 0;

  const submitOptions: SubmitOptions = {
    useWebSearch: isWebSearchEnabled,
    reasoningLevel: modelSupportsReasoningLevels ? reasoningLevel : undefined,
  };

  const submitMessage = (e: FormEvent) => {
    if (!canSubmit) {
      return;
    }
    handleSubmit(e, submitOptions);
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isComposing) {
      e.preventDefault();
      submitMessage(e);
    }
  };

  // Auto-alto del textarea para cualquier cambio de valor (tecleo, sugerencias,
  // limpieza tras enviar).
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    // Con el input vacío basta el alto mínimo del CSS; medir scrollHeight en
    // ese estado puede capturar un layout intermedio y dejar el textarea
    // estirado a su altura máxima.
    if (inputValue !== '') {
      textarea.style.height = `${Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
    }
  }, [inputValue, textareaRef]);

  return {
    canSubmit,
    handleInputChange,
    handleKeyDown,
    setIsComposing,
    submitMessage,
  };
};
