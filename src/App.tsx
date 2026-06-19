/**
 * App - Componente principal de Ozyra Open
 *
 * Refactorizado para usar hooks y utilidades modulares
 */
import React, { Suspense, useCallback, useEffect, useRef } from 'react';
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
import { WelcomeEmptyState } from './components/App/WelcomeEmptyState';
import { ScrollToBottom } from './components/ui/ScrollToBottom';

// Config & Models
import {
  availableModels,
  DEFAULT_MODEL_ID,
  getValidModelId,
  recordModelUsage,
} from './config/models';
// Types
import type { Chat as ChatType } from './types';

// Hooks
import { useLocalUsageCounters } from './hooks/useLocalUsageCounters';
import { useAppBootstrap } from './hooks/useAppBootstrap';
import { useAppUiState } from './hooks/useAppUiState';
import { useChatGeneration } from './hooks/useChatGeneration';
import { useChatNavigation } from './hooks/useChatNavigation';
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts';
import { useMessageEditing } from './hooks/useMessageEditing';
import { useChatCustomization } from './hooks/useChatCustomization';

// Services & Utils
import { exportChatToJSON } from './utils/chatOperations';
import { copyToClipboard as copyTextToClipboard } from './utils/messageOperations';
import { importChatsFromFile, mergeImportedChats } from './utils/importChats';
import {
  savePreferencesToLocalStorage,
  updatePreferencesInDatabase,
} from './utils/userPreferences';
import { getInitialLanguage, LANGUAGE_STORAGE_KEY, translate, type Language } from './i18n';

const readLocalPreference = (key: string): string => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const getInitialDarkMode = (): boolean => {
  const savedTheme = readLocalPreference('theme');
  if (savedTheme) {
    return savedTheme === 'dark';
  }
  return typeof window === 'undefined'
    ? true
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
};

const copyToClipboard = async (text: string): Promise<void> => {
  const success = await copyTextToClipboard(text);
  if (!success) {
    toast.error('Error al copiar el texto');
  }
};

/**
 * Componente principal de la aplicación Ozyra Open
 *
 * Renderiza la interfaz completa de la aplicación incluyendo sidebar,
 * área de chat, barra de mensajes y modales de configuración.
 * Gestiona todo el estado global y las interacciones del usuario.
 *
 * @returns {JSX.Element} Elemento JSX que representa la aplicación completa
 */
function App() {
  const {
    sidebarOpen,
    setSidebarOpen,
    isDarkMode,
    setIsDarkMode,
    language,
    setLanguage: setLanguageState,
    inputValue,
    setInputValue,
    welcomeCategory,
    setWelcomeCategory,
    showSettings,
    setShowSettings,
    isModelDropdownOpen,
    setIsModelDropdownOpen,
    modelSearchQuery,
    setModelSearchQuery,
    showAdvancedSearch,
    setShowAdvancedSearch,
    showCommandPalette,
    setShowCommandPalette,
    showChatCustomization,
    setShowChatCustomization,
    currentChatCustomizationInput,
    setCurrentChatCustomizationInput,
    isImprovingChatCustomization,
    setIsImprovingChatCustomization,
    userName,
    setUserName,
    userKnowledge,
    setUserKnowledge,
    userTraits,
    setUserTraits,
    userAdditionalInfo,
    setUserAdditionalInfo,
    uploadedImages,
    setUploadedImages,
    editingMessageId,
    setEditingMessageId,
    editingContent,
    setEditingContent,
  } = useAppUiState(() => ({
    sidebarOpen:
      typeof window === 'undefined' ? true : window.matchMedia('(min-width: 640px)').matches,
    isDarkMode: getInitialDarkMode(),
    language: getInitialLanguage(),
    inputValue: '',
    welcomeCategory: 'Explorar',
    showSettings: false,
    isModelDropdownOpen: false,
    modelSearchQuery: '',
    showAdvancedSearch: false,
    showCommandPalette: false,
    showChatCustomization: false,
    currentChatCustomizationInput: '',
    isImprovingChatCustomization: false,
    userName: readLocalPreference('userName'),
    userKnowledge: readLocalPreference('userKnowledge'),
    userTraits: readLocalPreference('userTraits'),
    userAdditionalInfo: readLocalPreference('userAdditionalInfo'),
    uploadedImages: [],
    editingMessageId: null,
    editingContent: '',
  }));
  const t = useCallback(
    (key: Parameters<typeof translate>[1]) => translate(language, key),
    [language]
  );

  const setLanguage = useCallback(
    (nextLanguage: Language) => {
      setLanguageState(nextLanguage);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
      } catch (error) {
        console.warn('No se pudo guardar el idioma seleccionado', error);
      }
    },
    [setLanguageState]
  );

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Referencia para el menú desplegable de modelos
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useAppKeyboardShortcuts({
    setSidebarOpen,
    setShowAdvancedSearch,
    setShowCommandPalette,
    textareaRef,
  });

  useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 640px)');
    const syncSidebarToViewport = (event: MediaQueryListEvent) => {
      setSidebarOpen(event.matches);
    };

    desktopMedia.addEventListener('change', syncSidebarToViewport);
    return () => desktopMedia.removeEventListener('change', syncSidebarToViewport);
  }, [setSidebarOpen]);

  // Contadores locales informativos para el perfil local.
  const { incrementUsage, updateUsageFromProfile } = useLocalUsageCounters();

  // Bootstrap de perfil local, chats y modelos habilitados.
  const {
    userId,
    isLocalProfileLoading,
    chats,
    setChats,
    currentChat,
    setCurrentChat,
    selectedModel,
    setSelectedModel,
    enabledModelIds,
    setEnabledModelIds,
    deleteAllChats: deleteAllChatsHook,
    deleteChat: deleteChatHook,
    togglePinChat: togglePinChatHook,
    updateChatTitle: updateChatTitleHook,
  } = useAppBootstrap({ updateUsageFromProfile });

  const {
    generatingChatIds,
    partialResponse,
    streamingComplete,
    isLoading,
    handleSubmit,
    cancelGeneration,
    regenerateResponse,
  } = useChatGeneration({
    userId,
    chats,
    setChats,
    currentChat,
    setCurrentChat,
    selectedModel,
    inputValue,
    setInputValue,
    uploadedImages,
    setUploadedImages,
    preferences: {
      userName,
      userKnowledge,
      userTraits,
      userAdditionalInfo,
    },
    incrementUsage,
  });

  // Perfil local y migraciones gestionadas por hook bootstrap.

  // Persistencia de modelo gestionada por useAppBootstrap

  // Sesión y migraciones gestionadas por useAppBootstrap

  // Persistencia local de chats gestionada por useAppBootstrap

  // Autoscroll ahora lo gestiona el propio ChatContainer

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Con el input vacío basta el alto mínimo del CSS; medir scrollHeight
      // en ese estado puede capturar un layout intermedio y dejar el
      // textarea estirado a su altura máxima.
      if (inputValue !== '') {
        const maxHeight = 200;
        const scrollHeight = textarea.scrollHeight;
        textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      }
    }
  }, [inputValue]);

  // Modelos habilitados gestionados por useAppBootstrap

  const { startNewChat } = useChatNavigation({
    chats,
    currentChat,
    setCurrentChat,
    setInputValue,
    setUploadedImages,
    setIsModelDropdownOpen,
    textareaRef,
  });

  const toggleModelEnabled = useCallback(
    (modelId: string) => {
      setEnabledModelIds((prev) =>
        prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
      );
    },
    [setEnabledModelIds]
  );

  const handleModelSelect = (modelId: string) => {
    const validModelId = getValidModelId(modelId);
    recordModelUsage(validModelId);
    setSelectedModel(validModelId); // El guardado en localStorage se maneja automáticamente en useEffect
    setEnabledModelIds((prev) => (prev.includes(validModelId) ? prev : [...prev, validModelId]));

    setIsModelDropdownOpen(false);
    if (currentChat) {
      const updatedChat = { ...currentChat, model: validModelId };
      setCurrentChat(updatedChat);
      setChats(chats.map((chat: ChatType) => (chat.id === currentChat.id ? updatedChat : chat)));
    }
  };

  // Borrar chat usando el hook centralizado
  const deleteChat = useCallback(
    async (chatId: string) => {
      const chatToDelete = chats.find((chat) => chat.id === chatId);
      if (!chatToDelete) {
        return;
      }
      if (!window.confirm(`¿Seguro que quieres borrar "${chatToDelete.title}"?`)) {
        return;
      }

      try {
        await deleteChatHook(chatId);
        if (currentChat?.id === chatId) {
          const remainingChats = chats
            .filter((chat) => chat.id !== chatId)
            .sort((a, b) => b.createdAt - a.createdAt);
          const nextChat = remainingChats.length > 0 ? remainingChats[0] : null;
          setCurrentChat(nextChat);
          if (nextChat) {
            setSelectedModel(getValidModelId(nextChat.model));
            localStorage.setItem('lastActiveChatId', nextChat.id);
          } else {
            setSelectedModel(DEFAULT_MODEL_ID);
            localStorage.removeItem('lastActiveChatId');
          }
        }
      } catch (error) {
        console.error('[deleteChat] Error al eliminar chat:', error);
        toast.error('Error al eliminar la conversación.');
      }
    },
    [chats, currentChat?.id, deleteChatHook, setCurrentChat, setSelectedModel]
  );

  const toggleTheme = useCallback(() => {
    setIsDarkMode((currentIsDarkMode) => {
      const nextIsDarkMode = !currentIsDarkMode;
      localStorage.setItem('theme', nextIsDarkMode ? 'dark' : 'light');
      document.body.classList.toggle('dark', nextIsDarkMode);
      document.body.classList.toggle('light', !nextIsDarkMode);
      return nextIsDarkMode;
    });
  }, [setIsDarkMode]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('light', !isDarkMode);
  }, [isDarkMode]);

  const deleteAllChats = useCallback(async () => {
    if (
      !window.confirm(
        '¿Estás seguro de que quieres borrar TODAS las conversaciones? Esta acción no se puede deshacer.'
      )
    ) {
      return;
    }
    try {
      await deleteAllChatsHook();
      setShowSettings(false);
    } catch (error) {
      console.error('[deleteAllChats] Error al borrar chats:', error);
      toast.error('Error al eliminar las conversaciones.');
    }
  }, [deleteAllChatsHook, setShowSettings]);

  // Guardar preferencias (delegado a utilidad)
  const handleSavePreferences = useCallback(
    async (prefs: { name: string; knowledge: string; traits: string; additionalInfo: string }) => {
      setUserName(prefs.name);
      setUserKnowledge(prefs.knowledge);
      setUserTraits(prefs.traits);
      setUserAdditionalInfo(prefs.additionalInfo);
      savePreferencesToLocalStorage(prefs);

      if (userId) {
        try {
          await updatePreferencesInDatabase(userId, prefs);
        } catch (err) {
          console.error('Error al actualizar preferencias locales:', err);
          toast.error('Error al guardar preferencias en el perfil local');
        }
      }
    },
    [setUserAdditionalInfo, setUserKnowledge, setUserName, setUserTraits, userId]
  );

  // Fijar/desfijar chat delegando en el hook centralizado
  const togglePinChat = async (chatId: string) => {
    try {
      await togglePinChatHook(chatId);
    } catch (error) {
      console.error('[togglePinChat] Error al actualizar fijado:', error);
      toast.error('Error al actualizar fijado');
    }
  };

  const { startEditingMessage, saveMessageEdit, cancelMessageEdit } = useMessageEditing({
    currentChat,
    setChats,
    setCurrentChat,
    editingContent,
    setEditingMessageId,
    setEditingContent,
  });

  const {
    toggleChatCustomizationPopup,
    handleSaveChatCustomization,
    handleImproveChatCustomization,
  } = useChatCustomization({
    currentChat,
    setCurrentChat,
    setChats,
    userId,
    showChatCustomization,
    setShowChatCustomization,
    currentChatCustomizationInput,
    setCurrentChatCustomizationInput,
    setIsImprovingChatCustomization,
  });

  // Actualizar título de chat usando el hook centralizado
  const updateChatTitle = async (chatId: string, newTitle: string) => {
    try {
      await updateChatTitleHook(chatId, newTitle);
    } catch (error) {
      console.error('Error al actualizar título en historial local:', error);
      toast.error('Error al actualizar título');
    }
  };

  const handleExport = useCallback(() => {
    const exportData = {
      chats: chats.map((chat) => ({
        ...chat,
        exportedAt: new Date().toISOString(),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ozyra-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [chats]);

  const handleImport = useCallback(async () => {
    const result = await importChatsFromFile({ userId });

    if (!result) {
      return;
    } // Usuario canceló

    if (result.error) {
      toast.error(result.error);
      return;
    }

    if (result.chats.length > 0) {
      setChats((prevChats) => mergeImportedChats(prevChats, result.chats));
      toast.success(`${result.chats.length} chats importados correctamente`);
    }
  }, [setChats, userId]);

  const closeAdvancedSearch = useCallback(
    () => setShowAdvancedSearch(false),
    [setShowAdvancedSearch]
  );
  const closeCommandPalette = useCallback(
    () => setShowCommandPalette(false),
    [setShowCommandPalette]
  );
  const handleAdvancedSearchSelect = useCallback(
    (chatId: string) => {
      const chat = chats.find((candidate) => candidate.id === chatId);
      if (chat) {
        setCurrentChat(chat);
        setShowAdvancedSearch(false);
      }
    },
    [chats, setCurrentChat, setShowAdvancedSearch]
  );
  const handleCommandPaletteSelect = useCallback(
    (chatId: string) => {
      const chat = chats.find((candidate) => candidate.id === chatId);
      if (chat) {
        setCurrentChat(chat);
      }
      setShowCommandPalette(false);
    },
    [chats, setCurrentChat, setShowCommandPalette]
  );
  const handleCommandPaletteAction = useCallback(
    (commandId: string) => {
      switch (commandId) {
        case 'new-chat':
          startNewChat();
          break;
        case 'settings':
          setShowSettings(true);
          break;
        case 'export':
          if (currentChat) {
            exportChatToJSON(currentChat);
          }
          break;
        case 'delete':
          if (currentChat) {
            void deleteChat(currentChat.id);
          }
          break;
        case 'toggle-theme':
          toggleTheme();
          break;
      }
      setShowCommandPalette(false);
    },
    [currentChat, deleteChat, setShowCommandPalette, setShowSettings, startNewChat, toggleTheme]
  );
  const openSidebar = useCallback(() => setSidebarOpen(true), [setSidebarOpen]);

  const lastVisibleMessage = currentChat?.messages[currentChat.messages.length - 1];
  const scrollFollowKey = lastVisibleMessage
    ? [
        currentChat?.id,
        currentChat?.messages.length,
        lastVisibleMessage.id,
        lastVisibleMessage.content.length,
        lastVisibleMessage.thinkingContent?.length ?? 0,
      ].join(':')
    : null;
  const handleWelcomeSuggestionSelect = useCallback(
    (suggestion: string) => {
      setInputValue(suggestion);
      setTimeout(() => textareaRef.current?.focus(), 0);
    },
    [setInputValue]
  );

  return (
    <div
      className={`flex h-screen ${isDarkMode ? 'dark' : 'light'} overflow-hidden font-sans relative`}
      style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}
    >
      <AppToaster isDarkMode={isDarkMode} />

      <ChatSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        currentChat={currentChat}
        chats={chats}
        setCurrentChat={setCurrentChat}
        createNewChat={startNewChat}
        togglePinChat={togglePinChat}
        exportChat={exportChatToJSON}
        deleteChat={deleteChat}
        setShowSettings={setShowSettings}
        updateChatTitle={updateChatTitle}
        generatingChatIds={generatingChatIds}
      />

      <div
        className="flex-1 flex flex-col min-w-0 relative"
        style={{ background: 'var(--bg-main)' }}
      >
        {!sidebarOpen && (
          <CollapsedChatActions onOpenSidebar={openSidebar} onNewChat={startNewChat} />
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar" ref={messagesContainerRef}>
          {currentChat && currentChat.messages.length > 0 ? (
            <Chat
              currentChat={currentChat}
              isDarkMode={isDarkMode}
              isLoading={isLoading}
              partialResponse={partialResponse}
              streamingComplete={streamingComplete}
              selectedModel={selectedModel}
              editingMessageId={editingMessageId}
              editingContent={editingContent}
              copyToClipboard={copyToClipboard}
              startEditingMessage={startEditingMessage}
              saveMessageEdit={saveMessageEdit}
              cancelMessageEdit={cancelMessageEdit}
              regenerateResponse={regenerateResponse}
              setEditingContent={setEditingContent}
              availableModels={availableModels}
            />
          ) : (
            <WelcomeEmptyState
              isLocalProfileLoading={isLocalProfileLoading}
              userName={userName}
              welcomeCategory={welcomeCategory}
              onWelcomeCategoryChange={setWelcomeCategory}
              onSuggestionSelect={handleWelcomeSuggestionSelect}
            />
          )}
        </div>

        <ChatComposerDock>
          <ChatMessageBar
            uiState={{
              isDarkMode,
              isLoading,
              isModelDropdownOpen,
              showChatCustomization,
              isImprovingChatCustomization,
            }}
            inputValue={inputValue}
            setInputValue={setInputValue}
            handleSubmit={handleSubmit}
            currentChat={currentChat}
            selectedModel={selectedModel}
            setIsModelDropdownOpen={setIsModelDropdownOpen}
            modelDropdownRef={modelDropdownRef}
            modelSearchQuery={modelSearchQuery}
            setModelSearchQuery={setModelSearchQuery}
            enabledModelIds={enabledModelIds}
            handleModelSelect={handleModelSelect}
            setShowSettings={setShowSettings}
            setShowChatCustomization={setShowChatCustomization}
            currentChatCustomizationInput={currentChatCustomizationInput}
            setCurrentChatCustomizationInput={setCurrentChatCustomizationInput}
            toggleChatCustomizationPopup={toggleChatCustomizationPopup}
            handleSaveChatCustomization={handleSaveChatCustomization}
            handleImproveChatCustomization={handleImproveChatCustomization}
            textareaRef={textareaRef}
            cancelGeneration={cancelGeneration}
            uploadedImages={uploadedImages}
            setUploadedImages={setUploadedImages}
          />
        </ChatComposerDock>
      </div>

      <Suspense fallback={null}>
        <SettingsModal
          key={showSettings ? 'open' : 'closed'}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          deleteAllChats={deleteAllChats}
          enabledModelIds={enabledModelIds}
          toggleModelEnabled={toggleModelEnabled}
          userName={userName}
          userKnowledge={userKnowledge}
          userTraits={userTraits}
          userAdditionalInfo={userAdditionalInfo}
          onSavePreferences={handleSavePreferences}
          handleImport={handleImport}
          handleExport={handleExport}
          language={language}
          setLanguage={setLanguage}
          t={t}
        />
      </Suspense>

      <AppInteractionOverlays
        showAdvancedSearch={showAdvancedSearch}
        showCommandPalette={showCommandPalette}
        chats={chats}
        availableModelIds={availableModels.map((model) => model.id)}
        isDarkMode={isDarkMode}
        onCloseAdvancedSearch={closeAdvancedSearch}
        onAdvancedSearchSelect={handleAdvancedSearchSelect}
        onCloseCommandPalette={closeCommandPalette}
        onCommandPaletteSelect={handleCommandPaletteSelect}
        onCommandPaletteAction={handleCommandPaletteAction}
      />

      {/* Scroll to bottom button */}
      <ScrollToBottom
        containerRef={messagesContainerRef}
        hasNewMessages={!streamingComplete && !!partialResponse}
        followKey={scrollFollowKey}
        resetKey={currentChat?.id ?? null}
      />
    </div>
  );
}

export default App;
