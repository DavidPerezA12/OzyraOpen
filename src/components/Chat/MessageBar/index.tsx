import { useId, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { modelHasCapability } from '../../../models/catalog';
import { AttachmentButton } from './AttachmentButton';
import { AttachmentPreview } from './AttachmentPreview';
import { ChatCustomizationPanel } from './ChatCustomizationPanel';
import { ModelSelectorInline } from './ModelSelectorInline';
import { ReasoningLevelSelector, WebSearchToggle } from './MessageOptionsMenu';
import { SendButton } from './SendButton';
import type { ChatMessageBarProps, ReasoningLevel } from './types';
import { useAttachments } from './useAttachments';
import { useMessageInput } from './useMessageInput';
import { t } from '../../../i18n';

const ChatMessageBar = ({
  isDarkMode,
  isGenerating,
  hasActiveChat,
  composer,
  textareaRef,
  onSubmit,
  onCancel,
  modelPicker,
  customization,
}: ChatMessageBarProps) => {
  const { inputValue, setInputValue, uploadedImages, setUploadedImages } = composer;
  const uploadInputId = useId();
  const modelSupportsImages = modelHasCapability(modelPicker.selectedModel, 'vision');
  const modelSupportsReasoningLevels = modelHasCapability(
    modelPicker.selectedModel,
    'effortControl'
  );

  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [reasoningLevel, setReasoningLevel] = useState<ReasoningLevel>('medium');
  const { addFileAsImage, handleImageUpload, isPreviewOpen, removeImage } = useAttachments({
    uploadedImages,
    setUploadedImages,
  });

  const { canSubmit, handleInputChange, handleKeyDown, setIsComposing, submitMessage } =
    useMessageInput({
      inputValue,
      setInputValue,
      textareaRef,
      isLoading: isGenerating,
      uploadedImages,
      handleSubmit: onSubmit,
      isWebSearchEnabled,
      modelSupportsReasoningLevels,
      reasoningLevel,
    });

  return (
    <>
      {customization.isOpen && (
        <div id="chat-customization-panel">
          <ChatCustomizationPanel customization={customization} />
        </div>
      )}

      <div className="composer-wrap relative flex flex-col" aria-busy={isGenerating}>
        {isPreviewOpen && uploadedImages.length > 0 && (
          <div className="px-3 pt-3">
            <AttachmentPreview
              uploadedImages={uploadedImages}
              isDarkMode={isDarkMode}
              onRemoveImage={removeImage}
            />
          </div>
        )}

        <form
          action="#"
          onSubmit={submitMessage}
          className="flex flex-col flex-1"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files || []);
            files.forEach((file) => addFileAsImage(file));
          }}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onPaste={(e) => {
              const items = e.clipboardData?.items;
              if (!items) {
                return;
              }
              for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item) {
                  continue;
                }
                if (item.kind === 'file') {
                  const file = item.getAsFile();
                  if (file) {
                    addFileAsImage(file);
                  }
                }
              }
            }}
            placeholder={t('composerPlaceholder')}
            aria-label={t('composerLabel')}
            className="composer-textarea custom-scrollbar"
            rows={1}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={handleKeyDown}
          />

          <div className="composer-toolbar">
            <div className="composer-toolbar-group">
              <ModelSelectorInline {...modelPicker} />

              {modelSupportsReasoningLevels && (
                <ReasoningLevelSelector
                  isLoading={isGenerating}
                  reasoningLevel={reasoningLevel}
                  setReasoningLevel={setReasoningLevel}
                />
              )}

              <WebSearchToggle
                isLoading={isGenerating}
                isWebSearchEnabled={isWebSearchEnabled}
                onToggleWebSearch={() => setIsWebSearchEnabled((prev) => !prev)}
              />

              <button
                type="button"
                onClick={() => {
                  if (!isGenerating && hasActiveChat) {
                    customization.toggle();
                  }
                }}
                className={`composer-icon-btn ${customization.isOpen ? 'active' : ''} ${isGenerating || !hasActiveChat ? 'is-disabled' : ''}`}
                title={hasActiveChat ? t('customizeChat') : t('customizeChatDisabled')}
                aria-label={hasActiveChat ? t('customizeChat') : t('customizeChatDisabled')}
                aria-expanded={customization.isOpen}
                aria-controls="chat-customization-panel"
                aria-disabled={isGenerating || !hasActiveChat}
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>

            <div className="composer-toolbar-group">
              {modelSupportsImages && (
                <AttachmentButton
                  inputId={`image-upload-${uploadInputId}`}
                  isLoading={isGenerating}
                  onImageUpload={handleImageUpload}
                />
              )}

              <SendButton
                isLoading={isGenerating}
                canSubmit={canSubmit}
                cancelGeneration={onCancel}
              />
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default ChatMessageBar;
