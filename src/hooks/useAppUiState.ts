import { useCallback, useMemo, useReducer, type Dispatch, type SetStateAction } from 'react';
import type { Language } from '../i18n';
import type { UploadedImage } from '../types';

export type WelcomeCategory = 'Crear' | 'Explorar' | 'Programar' | 'Aprender';

interface AppUiState {
  sidebarOpen: boolean;
  isDarkMode: boolean;
  language: Language;
  inputValue: string;
  welcomeCategory: WelcomeCategory;
  showSettings: boolean;
  isModelDropdownOpen: boolean;
  modelSearchQuery: string;
  showAdvancedSearch: boolean;
  showCommandPalette: boolean;
  showChatCustomization: boolean;
  currentChatCustomizationInput: string;
  isImprovingChatCustomization: boolean;
  userName: string;
  userKnowledge: string;
  userTraits: string;
  userAdditionalInfo: string;
  uploadedImages: UploadedImage[];
  editingMessageId: string | null;
  editingContent: string;
}

type AppUiAction = {
  [Key in keyof AppUiState]: {
    key: Key;
    value: SetStateAction<AppUiState[Key]>;
  };
}[keyof AppUiState];

const appUiReducer = (state: AppUiState, action: AppUiAction): AppUiState => {
  const currentValue = state[action.key];
  const nextValue =
    typeof action.value === 'function'
      ? (action.value as (current: typeof currentValue) => typeof currentValue)(currentValue)
      : action.value;

  return { ...state, [action.key]: nextValue };
};

type AppUiSetters = {
  [Key in keyof AppUiState as `set${Capitalize<Key>}`]: Dispatch<SetStateAction<AppUiState[Key]>>;
};

export const useAppUiState = (createInitialState: () => AppUiState): AppUiState & AppUiSetters => {
  const [state, dispatch] = useReducer(appUiReducer, undefined, createInitialState);
  const setValue = useCallback(
    <Key extends keyof AppUiState>(key: Key, value: SetStateAction<AppUiState[Key]>) => {
      dispatch({ key, value } as AppUiAction);
    },
    []
  );

  const setters = useMemo<AppUiSetters>(
    () => ({
      setSidebarOpen: (value) => setValue('sidebarOpen', value),
      setIsDarkMode: (value) => setValue('isDarkMode', value),
      setLanguage: (value) => setValue('language', value),
      setInputValue: (value) => setValue('inputValue', value),
      setWelcomeCategory: (value) => setValue('welcomeCategory', value),
      setShowSettings: (value) => setValue('showSettings', value),
      setIsModelDropdownOpen: (value) => setValue('isModelDropdownOpen', value),
      setModelSearchQuery: (value) => setValue('modelSearchQuery', value),
      setShowAdvancedSearch: (value) => setValue('showAdvancedSearch', value),
      setShowCommandPalette: (value) => setValue('showCommandPalette', value),
      setShowChatCustomization: (value) => setValue('showChatCustomization', value),
      setCurrentChatCustomizationInput: (value) => setValue('currentChatCustomizationInput', value),
      setIsImprovingChatCustomization: (value) => setValue('isImprovingChatCustomization', value),
      setUserName: (value) => setValue('userName', value),
      setUserKnowledge: (value) => setValue('userKnowledge', value),
      setUserTraits: (value) => setValue('userTraits', value),
      setUserAdditionalInfo: (value) => setValue('userAdditionalInfo', value),
      setUploadedImages: (value) => setValue('uploadedImages', value),
      setEditingMessageId: (value) => setValue('editingMessageId', value),
      setEditingContent: (value) => setValue('editingContent', value),
    }),
    [setValue]
  );

  return { ...state, ...setters };
};
