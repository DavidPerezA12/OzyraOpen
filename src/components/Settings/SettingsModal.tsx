/**
 * SettingsModal — rediseño total. Layout flat tipo Vercel/Linear.
 * Sin burbujas, sin gradientes ruidosos. Filas con separadores.
 */

import React, { useEffect, useReducer, useRef } from 'react';
import { logger } from '../../utils/logger';
import CustomizationSection from './sections/CustomizationSection';
import HistorySection from './sections/HistorySection';
import LocalProfileSection from './sections/LocalProfileSection';
import ModelsSection from './sections/ModelsSection';
import AboutSection from './sections/AboutSection';
import SearchSection from './sections/SearchSection';
import ShortcutsSection from './sections/ShortcutsSection';
import SettingsNav from './SettingsNav';
import SettingsTopBar from './SettingsTopBar';
import type { Language, TranslationKey } from '../../i18n';
import type { SettingsTab } from './types';

interface CapabilityFiltersState {
  readonly fast: boolean;
  readonly vision: boolean;
  readonly reasoning: boolean;
  readonly effortControl: boolean;
  readonly toolCalling: boolean;
  readonly imageGeneration: boolean;
  readonly pdfComprehension: boolean;
}

const EMPTY_CAPABILITY_FILTERS: CapabilityFiltersState = {
  fast: false,
  vision: false,
  reasoning: false,
  effortControl: false,
  toolCalling: false,
  imageGeneration: false,
  pdfComprehension: false,
};

interface SettingsModalState {
  readonly activeTab: SettingsTab;
  readonly userName: string;
  readonly userKnowledge: string;
  readonly userTraits: string;
  readonly userAdditionalInfo: string;
  readonly showReasoning: boolean;
  readonly capabilityFilters: CapabilityFiltersState;
  readonly modelSearch: string;
  readonly selectedProviders: string[];
}

interface SettingsModalInitialState {
  readonly userName: string;
  readonly userKnowledge: string;
  readonly userTraits: string;
  readonly userAdditionalInfo: string;
}

const getInitialShowReasoning = (): boolean => {
  try {
    const stored = localStorage.getItem('ozyra:ui:showThinking');
    return stored === null ? true : stored === '1';
  } catch {
    return true;
  }
};

const createSettingsModalState = ({
  userName,
  userKnowledge,
  userTraits,
  userAdditionalInfo,
}: SettingsModalInitialState): SettingsModalState => ({
  activeTab: 'local_profile',
  userName: userName || '',
  userKnowledge: userKnowledge || '',
  userTraits: userTraits || '',
  userAdditionalInfo: userAdditionalInfo || '',
  showReasoning: getInitialShowReasoning(),
  capabilityFilters: EMPTY_CAPABILITY_FILTERS,
  modelSearch: '',
  selectedProviders: [],
});

const settingsModalReducer = (
  state: SettingsModalState,
  patch: Partial<SettingsModalState>
): SettingsModalState => ({ ...state, ...patch });

export interface UserPreferences {
  readonly name: string;
  readonly knowledge: string;
  readonly traits: string;
  readonly additionalInfo: string;
}

export interface SettingsModalProps {
  readonly showSettings: boolean;
  readonly setShowSettings: (show: boolean) => void;
  readonly isDarkMode: boolean;
  readonly toggleTheme: () => void;
  readonly deleteAllChats: () => void;
  readonly enabledModelIds: readonly string[];
  readonly toggleModelEnabled: (modelId: string) => void;
  readonly userName: string;
  readonly userKnowledge: string;
  readonly userTraits: string;
  readonly userAdditionalInfo: string;
  readonly onSavePreferences: (prefs: UserPreferences) => void;
  readonly handleImport: () => void;
  readonly handleExport: () => void;
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
  readonly t: (key: TranslationKey) => string;
}

// ─────────────────────────────────────────────
// Modal principal
// ─────────────────────────────────────────────
const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettings,
  setShowSettings,
  isDarkMode,
  toggleTheme,
  deleteAllChats,
  enabledModelIds,
  toggleModelEnabled,
  userName: initialUserName,
  userKnowledge: initialUserKnowledge,
  userTraits: initialUserTraits,
  userAdditionalInfo: initialUserAdditionalInfo,
  onSavePreferences,
  handleImport,
  handleExport,
  language,
  setLanguage,
  t,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [settingsState, updateSettingsState] = useReducer(
    settingsModalReducer,
    {
      userName: initialUserName,
      userKnowledge: initialUserKnowledge,
      userTraits: initialUserTraits,
      userAdditionalInfo: initialUserAdditionalInfo,
    },
    createSettingsModalState
  );
  const {
    activeTab,
    capabilityFilters,
    modelSearch,
    selectedProviders,
    showReasoning,
    userAdditionalInfo,
    userKnowledge,
    userName,
    userTraits,
  } = settingsState;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (showSettings && dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }

    return () => {
      if (dialog?.open && typeof dialog.close === 'function') {
        dialog.close();
      }
    };
  }, [setShowSettings, showSettings]);

  if (!showSettings) {
    return null;
  }

  const handleInternalSavePreferences = () => {
    onSavePreferences({
      name: userName,
      knowledge: userKnowledge,
      traits: userTraits,
      additionalInfo: userAdditionalInfo,
    });
    logger.info('Guardando preferencias');
  };

  const handleThinkingPreference = (next: boolean) => {
    updateSettingsState({ showReasoning: next });
    try {
      localStorage.setItem('ozyra:ui:showThinking', next ? '1' : '0');
      window.dispatchEvent(
        new CustomEvent('ozyra:ui:showThinking-changed', { detail: { value: next } })
      );
    } catch (error) {
      logger.error('Error al guardar preferencia de razonamiento', error);
    }
  };

  const setActiveTab = (activeTab: SettingsTab) => updateSettingsState({ activeTab });
  const setUserName = (userName: string) => updateSettingsState({ userName });
  const setUserKnowledge = (userKnowledge: string) => updateSettingsState({ userKnowledge });
  const setUserTraits = (userTraits: string) => updateSettingsState({ userTraits });
  const setUserAdditionalInfo = (userAdditionalInfo: string) =>
    updateSettingsState({ userAdditionalInfo });
  const setModelSearch = (modelSearch: string) => updateSettingsState({ modelSearch });
  const setCapabilityFilters = (capabilityFilters: CapabilityFiltersState) =>
    updateSettingsState({ capabilityFilters });
  const setSelectedProviders = (selectedProviders: string[]) =>
    updateSettingsState({ selectedProviders });

  let content: React.ReactNode;
  switch (activeTab) {
    case 'local_profile':
      content = (
        <LocalProfileSection
          isDarkMode={isDarkMode}
          userName={userName}
          language={language}
          setLanguage={setLanguage}
          t={t}
        />
      );
      break;
    case 'customization':
      content = (
        <CustomizationSection
          userName={userName}
          setUserName={setUserName}
          userKnowledge={userKnowledge}
          setUserKnowledge={setUserKnowledge}
          userTraits={userTraits}
          setUserTraits={setUserTraits}
          userAdditionalInfo={userAdditionalInfo}
          setUserAdditionalInfo={setUserAdditionalInfo}
          showReasoning={showReasoning}
          setShowReasoning={handleThinkingPreference}
          onSavePreferences={handleInternalSavePreferences}
        />
      );
      break;
    case 'search':
      content = <SearchSection />;
      break;
    case 'history':
      content = (
        <HistorySection
          isDarkMode={isDarkMode}
          onImport={handleImport}
          onExport={handleExport}
          onDeleteAll={deleteAllChats}
          t={t}
        />
      );
      break;
    case 'models':
      content = (
        <ModelsSection
          isDarkMode={isDarkMode}
          enabledModelIds={[...enabledModelIds]}
          toggleModelEnabled={toggleModelEnabled}
          modelSearch={modelSearch}
          setModelSearch={setModelSearch}
          capabilityFilters={capabilityFilters}
          setCapabilityFilters={setCapabilityFilters}
          selectedProviders={selectedProviders}
          setSelectedProviders={setSelectedProviders}
          t={t}
        />
      );
      break;
    case 'shortcuts':
      content = <ShortcutsSection />;
      break;
    case 'about':
      content = <AboutSection />;
      break;
    default:
      content = null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="cfg-shell"
      aria-label="Ajustes"
      onCancel={(event) => {
        event.preventDefault();
        setShowSettings(false);
      }}
      style={{ background: 'var(--bg-settings)', color: 'var(--text-primary)' }}
    >
      <SettingsTopBar
        isDarkMode={isDarkMode}
        onBack={() => setShowSettings(false)}
        onToggleTheme={toggleTheme}
      />

      <div className="cfg-body">
        <SettingsNav activeTab={activeTab} onTabChange={setActiveTab} />

        <main
          key={activeTab}
          className={`cfg-content custom-scrollbar ${activeTab === 'models' ? 'cfg-content--wide' : ''}`}
        >
          {content}
        </main>
      </div>
    </dialog>
  );
};

export default SettingsModal;
