import { useId, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { modelHasCapability } from '../../../config/models';
import { AttachmentButton } from './AttachmentButton';
import { AttachmentPreview } from './AttachmentPreview';
import { ChatCustomizationPanel } from './ChatCustomizationPanel';
import { ModelSelectorInline } from './ModelSelectorInline';
import { ReasoningLevelSelector, WebSearchToggle } from './MessageOptionsMenu';
import { SendButton } from './SendButton';
import type { ChatMessageBarProps, ReasoningLevel } from './types';
import { useAttachments } from './useAttachments';
import { useMessageInput } from './useMessageInput';

const ChatMessageBar = ({
  uiState,
  inputValue,
  setInputValue,
  handleSubmit,
  currentChat,
  selectedModel,
  setIsModelDropdownOpen,
  modelDropdownRef,
  modelSearchQuery,
  setModelSearchQuery,
  enabledModelIds,
  handleModelSelect,
  setShowSettings,
  setShowChatCustomization,
  currentChatCustomizationInput,
  setCurrentChatCustomizationInput,
  toggleChatCustomizationPopup,
  handleSaveChatCustomization,
  handleImproveChatCustomization,
  textareaRef,
  cancelGeneration,
  uploadedImages,
  setUploadedImages,
}: ChatMessageBarProps) => {
  const {
    isDarkMode,
    isLoading,
    isModelDropdownOpen,
    showChatCustomization,
    isImprovingChatCustomization,
  } = uiState;
  const uploadInputId = useId();
  const modelSupportsImages = modelHasCapability(selectedModel, 'images');
  const modelSupportsReasoningLevels = modelHasCapability(selectedModel, 'reasoningLevels');

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
      isLoading,
      uploadedImages,
      handleSubmit,
      isWebSearchEnabled,
      modelSupportsReasoningLevels,
      reasoningLevel,
    });

  return (
    <>
      {showChatCustomization && (
        <ChatCustomizationPanel
          value={currentChatCustomizationInput}
          setValue={setCurrentChatCustomizationInput}
          setShowChatCustomization={setShowChatCustomization}
          handleSaveChatCustomization={handleSaveChatCustomization}
          handleImproveChatCustomization={handleImproveChatCustomization}
          isImprovingChatCustomization={isImprovingChatCustomization}
        />
      )}

      <div className="composer-wrap relative flex flex-col" aria-busy={isLoading}>
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
                if (item.kind === 'file') {
                  const file = item.getAsFile();
                  if (file) {
                    addFileAsImage(file);
                  }
                }
              }
            }}
            placeholder="Escribe tu mensaje aquí…"
            aria-label="Mensaje"
            className="composer-textarea custom-scrollbar"
            rows={1}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={handleKeyDown}
          />

          <div className="composer-toolbar">
            <div className="composer-toolbar-group">
              <ModelSelectorInline
                selectedModel={selectedModel}
                isModelDropdownOpen={isModelDropdownOpen}
                setIsModelDropdownOpen={setIsModelDropdownOpen}
                modelDropdownRef={modelDropdownRef}
                modelSearchQuery={modelSearchQuery}
                setModelSearchQuery={setModelSearchQuery}
                enabledModelIds={enabledModelIds}
                handleModelSelect={handleModelSelect}
                setShowSettings={setShowSettings}
              />

              {modelSupportsReasoningLevels && (
                <ReasoningLevelSelector
                  isLoading={isLoading}
                  reasoningLevel={reasoningLevel}
                  setReasoningLevel={setReasoningLevel}
                />
              )}

              <WebSearchToggle
                isLoading={isLoading}
                isWebSearchEnabled={isWebSearchEnabled}
                onToggleWebSearch={() => setIsWebSearchEnabled((prev) => !prev)}
              />

              <button
                type="button"
                onClick={() => {
                  if (!isLoading && currentChat) {
                    toggleChatCustomizationPopup();
                  }
                }}
                className={`composer-icon-btn ${showChatCustomization ? 'active' : ''} ${isLoading || !currentChat ? 'is-disabled' : ''}`}
                title={
                  currentChat
                    ? 'Personalizar esta conversación'
                    : 'Crea una conversación antes de personalizarla'
                }
                aria-label={
                  currentChat
                    ? 'Personalizar esta conversación'
                    : 'Crea una conversación antes de personalizarla'
                }
                aria-pressed={showChatCustomization}
                aria-disabled={isLoading || !currentChat}
              >
                <SlidersHorizontal size={15} />
              </button>
            </div>

            <div className="composer-toolbar-group">
              {modelSupportsImages && (
                <AttachmentButton
                  inputId={`image-upload-${uploadInputId}`}
                  isLoading={isLoading}
                  onImageUpload={handleImageUpload}
                />
              )}

              <SendButton
                isLoading={isLoading}
                canSubmit={canSubmit}
                cancelGeneration={cancelGeneration}
              />
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default ChatMessageBar;
