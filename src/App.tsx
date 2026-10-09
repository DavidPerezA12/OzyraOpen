/**
 * App - Componente principal de Ozyra Open
 *
 * Compone los hooks de estado (chats, generación, preferencias, tema) y
 * reparte sus datos entre sidebar, conversación, composer y overlays.
 */
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

// Components
import Chat from './components/Chat/ChatContainer';
import ChatMessageBar from './components/Chat/MessageBar';
import ChatSidebar from './components/Chat/ChatSidebar';
const SettingsModal = React.lazy(() => import('./components/Settings/SettingsModal'));

// UI Components
import { AppInteractionOverlays } from './components/App/AppInteractionOverlays';
import { AppToaster } from './components/App/AppToaster';
import { ChatComposerDock } from './components/App/ChatComposerDock';
import { CollapsedChatActions } from './components/App/CollapsedChatActions';
import { WelcomeEmptyState, type WelcomeCategory } from './components/App/WelcomeEmptyState';
import { ZoneErrorFallback } from './components/App/ZoneErrorFallback';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ScrollToBottom } from './components/ui/ScrollToBottom';

// State & hooks
import { useModelCatalog } from './models/catalog';
import { createChatStore, useChatState } from './state/chatStore';
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts';
import { useChatCustomization } from './hooks/useChatCustomization';
import { useChatGeneration, type ComposerState } from './hooks/useChatGeneration';
import { readLegacyLocalChats, useChatHistory } from './hooks/useChatHistory';
import { useChatNavigation } from './hooks/useChatNavigation';
import { useConfirm } from './hooks/useConfirm';
import { useFavorites } from './hooks/useFavorites';
import { useMessageEditing } from './hooks/useMessageEditing';
import { useModelPreferences } from './hooks/useModelPreferences';
import { useTheme } from './hooks/useTheme';
import { useUserPreferences } from './hooks/useUserPreferences';

// Services & Utils
import type { UploadedImage } from './types';
import { exportAllChatsToJSON, exportChatToJSON } from './utils/chatOperations';
import { copyToClipboard as copyTextToClipboard } from './utils/messageOperations';
import { importChatsFromFile, mergeImportedChats } from './utils/importChats';
import { t, useLanguage } from './i18n';
import { logger } from './utils/logger';

const DESKTOP_MEDIA_QUERY = '(min-width: 640px)';

const copyToClipboard = async (text: string): Promise<void> => {
  if (!(await copyTextToClipboard(text))) {
    toast.error(t('copyError'));
  }
};

function App() {
  // Suscripción al idioma: re-renderiza la app al cambiarlo.
  useLanguage();
  const { isDarkMode, toggleTheme } = useTheme();
  const { preferences, savePreferences } = useUserPreferences();
  const { models } = useModelCatalog();
  const { selectedModel, setSelectedModel, chooseModel, enabledModelIds, toggleModelEnabled } =
    useModelPreferences();

  // Chats: una sola fuente de verdad, el chat activo se deriva por id.
  const [store] = useState(() => createChatStore(readLegacyLocalChats()));
  const { chats, currentChatId } = useChatState(store);
  const currentChat = useMemo(
    () => chats.find((chat) => chat.id === currentChatId) ?? null,
    [chats, currentChatId]
  );

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia(DESKTOP_MEDIA_QUERY).matches
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [welcomeCategory, setWelcomeCategory] = useState<WelcomeCategory>('explore');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Composer
  const [inputValue, setInputValue] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const composer = useMemo<ComposerState>(
    () => ({ inputValue, setInputValue, uploadedImages, setUploadedImages }),
    [inputValue, uploadedImages]
  );

  const {
    isLoading: isHistoryLoading,
    deleteChat: deleteStoredChat,
    deleteAllChats: deleteAllStoredChats,
    togglePinChat: toggleStoredPin,
    renameChat: renameStoredChat,
  } = useChatHistory(store);
  const { generatingChatIds, handleSubmit, cancelGeneration, regenerateResponse } =
    useChatGeneration({ store, selectedModel, composer, preferences });
  const editing = useMessageEditing(store);
  const customization = useChatCustomization(store);
  const { confirm, confirmDialog } = useConfirm();
  const { favorites, toggleFavorite } = useFavorites();

  const resetComposer = useCallback(() => {
    setInputValue('');
    setUploadedImages([]);
  }, []);
  const { selectChat, startNewChat } = useChatNavigation({
    store,
    onNewChat: resetComposer,
    textareaRef,
    chatCount: chats.length,
  });

  useAppKeyboardShortcuts({
    setSidebarOpen,
    setShowAdvancedSearch,
    setShowCommandPalette,
    textareaRef,
  });

  useEffect(() => {
    const desktopMedia = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const syncSidebarToViewport = (event: MediaQueryListEvent) => setSidebarOpen(event.matches);
    desktopMedia.addEventListener('change', syncSidebarToViewport);
    return () => desktopMedia.removeEventListener('change', syncSidebarToViewport);
  }, []);

  useEffect(() => {
    const chatTitle = currentChat?.title.trim();
    document.title = chatTitle ? `${chatTitle} — Ozyra Open` : 'Ozyra Open';
  }, [currentChat?.title]);

  const handleModelSelect = useCallback(
    (modelId: string) => {
      const validModelId = chooseModel(modelId);
      const chatId = store.getState().currentChatId;
      if (chatId) {
        store.updateChat(chatId, (chat) => ({ ...chat, model: validModelId }));
      }
    },
    [chooseModel, store]
  );

  const deleteChat = useCallback(
    async (chatId: string) => {
      const chat = store.getChat(chatId);
      if (!chat) {
        return;
      }
      const confirmed = await confirm({
        title: t('deleteChatConfirmTitle'),
        message: t('deleteChatConfirmMessage', { title: chat.title }),
      });
      if (!confirmed) {
        return;
      }

      const wasCurrent = store.getState().currentChatId === chatId;
      try {
        const nextChat = await deleteStoredChat(chatId);
        if (wasCurrent && nextChat) {
          setSelectedModel(nextChat.model);
        }
      } catch (error) {
        logger.error('[deleteChat] Error al eliminar chat:', error);
        toast.error(t('deleteChatError'));
      }
    },
    [confirm, deleteStoredChat, setSelectedModel, store]
  );

  const deleteAllChats = useCallback(async () => {
    const confirmed = await confirm({
      title: t('deleteAllChatsTitle'),
      message: t('deleteAllChatsConfirm'),
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteAllStoredChats();
      setShowSettings(false);
    } catch (error) {
      logger.error('[deleteAllChats] Error al borrar chats:', error);
      toast.error(t('deleteChatsError'));
    }
  }, [confirm, deleteAllStoredChats]);

  const togglePinChat = useCallback(
    async (chatId: string) => {
      try {
        await toggleStoredPin(chatId);
      } catch (error) {
        logger.error('[togglePinChat] Error al actualizar fijado:', error);
        toast.error(t('updatePinError'));
      }
    },
    [toggleStoredPin]
  );

  const renameChat = useCallback(
    async (chatId: string, title: string) => {
      try {
        await renameStoredChat(chatId, title);
      } catch (error) {
        logger.error('Error al actualizar título en historial local:', error);
        toast.error(t('updateTitleError'));
      }
    },
    [renameStoredChat]
  );

  const handleExport = useCallback(() => exportAllChatsToJSON(store.getState().chats), [store]);

  const handleImport = useCallback(async () => {
    const result = await importChatsFromFile();
    if (!result) {
      return; // Usuario canceló
    }
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (result.chats.length > 0) {
      store.replaceChats(mergeImportedChats([...store.getState().chats], result.chats));
      toast.success(t('importSuccess', { count: result.chats.length }));
    }
  }, [store]);

  const openSettings = useCallback(() => setShowSettings(true), []);
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeAdvancedSearch = useCallback(() => setShowAdvancedSearch(false), []);
  const closeCommandPalette = useCallback(() => setShowCommandPalette(false), []);

  const handleAdvancedSearchSelect = useCallback(
    (chatId: string) => {
      selectChat(chatId);
      setShowAdvancedSearch(false);
    },
    [selectChat]
  );
  const handleCommandPaletteSelect = useCallback(
    (chatId: string) => {
      selectChat(chatId);
      setShowCommandPalette(false);
    },
    [selectChat]
  );
  const handleCommandPaletteAction = useCallback(
    (commandId: string) => {
      const chat = store.getCurrentChat();
      switch (commandId) {
        case 'new-chat':
          startNewChat();
          break;
        case 'settings':
          setShowSettings(true);
          break;
        case 'export':
          if (chat) {
            exportChatToJSON(chat);
          }
          break;
        case 'delete':
          if (chat) {
            void deleteChat(chat.id);
          }
          break;
        case 'toggle-theme':
          toggleTheme();
          break;
      }
      setShowCommandPalette(false);
    },
    [deleteChat, startNewChat, store, toggleTheme]
  );

  const handleWelcomeSuggestionSelect = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const isGenerating = currentChatId !== null && generatingChatIds.includes(currentChatId);
  const cancelCurrentGeneration = useCallback(() => cancelGeneration(), [cancelGeneration]);
  const modelPicker = useMemo(
    () => ({
      selectedModel,
      enabledModelIds,
      onSelectModel: handleModelSelect,
      onOpenSettings: openSettings,
    }),
    [enabledModelIds, handleModelSelect, openSettings, selectedModel]
  );

  const lastMessage = currentChat?.messages[currentChat.messages.length - 1];
  const scrollFollowKey = lastMessage
    ? [
        currentChat?.id,
        currentChat?.messages.length,
        lastMessage.id,
        lastMessage.content.length,
        lastMessage.thinkingContent?.length ?? 0,
      ].join(':')
    : null;
  const availableModelIds = useMemo(() => models.map((model) => model.id), [models]);

  return (
    <div
      className={`flex h-screen ${isDarkMode ? 'dark' : 'light'} overflow-hidden font-sans relative`}
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      <AppToaster isDarkMode={isDarkMode} />

      <ErrorBoundary renderFallback={(retry) => <ZoneErrorFallback onRetry={retry} />}>
        <ChatSidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          currentChatId={currentChatId}
          chats={chats}
          onSelectChat={selectChat}
          createNewChat={startNewChat}
          togglePinChat={togglePinChat}
          exportChat={exportChatToJSON}
          deleteChat={deleteChat}
          setShowSettings={setShowSettings}
          updateChatTitle={renameChat}
          generatingChatIds={generatingChatIds}
        />
      </ErrorBoundary>

      <div
        className="flex-1 flex flex-col min-w-0 relative"
        style={{ background: 'var(--bg-main)' }}
      >
        {!sidebarOpen && (
          <CollapsedChatActions onOpenSidebar={openSidebar} onNewChat={startNewChat} />
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar" ref={messagesContainerRef}>
          {currentChat && currentChat.messages.length > 0 ? (
            <ErrorBoundary
              resetKeys={[currentChat.id]}
              renderFallback={(retry) => <ZoneErrorFallback onRetry={retry} />}
            >
              <Chat
                currentChat={currentChat}
                isDarkMode={isDarkMode}
                isLoading={isGenerating}
                selectedModel={selectedModel}
                editingMessageId={editing.editingMessageId}
                editingContent={editing.editingContent}
                copyToClipboard={copyToClipboard}
                startEditingMessage={editing.startEditingMessage}
                saveMessageEdit={editing.saveMessageEdit}
                cancelMessageEdit={editing.cancelMessageEdit}
                regenerateResponse={regenerateResponse}
                setEditingContent={editing.setEditingContent}
              />
            </ErrorBoundary>
          ) : (
            <WelcomeEmptyState
              isLocalProfileLoading={isHistoryLoading}
              userName={preferences.name}
              welcomeCategory={welcomeCategory}
              onWelcomeCategoryChange={setWelcomeCategory}
              onSuggestionSelect={handleWelcomeSuggestionSelect}
            />
          )}
        </div>

        <ChatComposerDock>
          <ErrorBoundary renderFallback={(retry) => <ZoneErrorFallback onRetry={retry} />}>
            <ChatMessageBar
              isDarkMode={isDarkMode}
              isGenerating={isGenerating}
              hasActiveChat={currentChat !== null}
              composer={composer}
              textareaRef={textareaRef}
              onSubmit={handleSubmit}
              onCancel={cancelCurrentGeneration}
              modelPicker={modelPicker}
              customization={customization}
            />
          </ErrorBoundary>
        </ChatComposerDock>
      </div>

      <Suspense fallback={null}>
        <SettingsModal
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          deleteAllChats={deleteAllChats}
          enabledModelIds={enabledModelIds}
          toggleModelEnabled={toggleModelEnabled}
          preferences={preferences}
          onSavePreferences={savePreferences}
          handleImport={handleImport}
          handleExport={handleExport}
        />
      </Suspense>

      <AppInteractionOverlays
        showAdvancedSearch={showAdvancedSearch}
        showCommandPalette={showCommandPalette}
        chats={chats}
        availableModelIds={availableModelIds}
        isDarkMode={isDarkMode}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onCloseAdvancedSearch={closeAdvancedSearch}
        onAdvancedSearchSelect={handleAdvancedSearchSelect}
        onCloseCommandPalette={closeCommandPalette}
        onCommandPaletteSelect={handleCommandPaletteSelect}
        onCommandPaletteAction={handleCommandPaletteAction}
      />
      {confirmDialog}

      <ScrollToBottom
        containerRef={messagesContainerRef}
        hasNewMessages={isGenerating && Boolean(lastMessage?.content)}
        followKey={scrollFollowKey}
        resetKey={currentChatId}
      />
    </div>
  );
}

export default App;
