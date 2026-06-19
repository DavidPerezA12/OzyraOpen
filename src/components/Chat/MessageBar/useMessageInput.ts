import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import type { ReasoningLevel, SubmitOptions, UploadedImage } from './types';

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
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && !isComposing) {
      e.preventDefault();
      submitMessage(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current && inputValue === '') {
      // Con el input vacío basta con volver al alto mínimo definido en CSS;
      // medir scrollHeight aquí puede capturar un layout intermedio y dejar
      // el textarea estirado a su altura máxima.
      textareaRef.current.style.height = 'auto';
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
