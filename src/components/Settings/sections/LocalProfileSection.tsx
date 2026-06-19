import {
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  Folder,
  KeyRound,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useEffect, useReducer, useRef } from 'react';
import toast from 'react-hot-toast';
import { languageOptions, type Language, type TranslationKey } from '../../../i18n';
import {
  getStoredOpenRouterApiKey,
  saveOpenRouterApiKey,
} from '../../../services/openrouter/client';
import {
  isLocalFolderSyncSupported,
  loadLocalSyncDirectoryHandle,
  pickLocalSyncDirectory,
  saveLocalSyncDirectoryHandle,
  writeLocalFolderSnapshot,
} from '../../../utils/localFolderSync';

interface LocalProfileSectionProps {
  readonly isDarkMode: boolean;
  readonly userName: string;
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
  readonly t: (key: TranslationKey) => string;
}

interface LocalProfileState {
  readonly directoryHandle: FileSystemDirectoryHandle | null;
  readonly lastFolderSync: string | null;
  readonly isSyncingFolder: boolean;
  readonly isLangDropdownOpen: boolean;
  readonly apiKey: string;
  readonly savedApiKey: string;
}

const getInitialLocalProfileState = (): LocalProfileState => {
  const storedApiKey = getStoredOpenRouterApiKey();
  return {
    directoryHandle: null,
    lastFolderSync: null,
    isSyncingFolder: false,
    isLangDropdownOpen: false,
    apiKey: storedApiKey,
    savedApiKey: storedApiKey,
  };
};

const localProfileReducer = (
  state: LocalProfileState,
  patch: Partial<LocalProfileState>
): LocalProfileState => ({ ...state, ...patch });

const LocalProfileSection: React.FC<LocalProfileSectionProps> = ({ language, setLanguage, t }) => {
  const folderSyncSupported = isLocalFolderSyncSupported();
  const [localProfileState, updateLocalProfileState] = useReducer(
    localProfileReducer,
    undefined,
    getInitialLocalProfileState
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    apiKey,
    directoryHandle,
    isLangDropdownOpen,
    isSyncingFolder,
    lastFolderSync,
    savedApiKey,
  } = localProfileState;

  const apiKeyDirty = apiKey.trim() !== savedApiKey;

  const saveApiKey = () => {
    const trimmed = apiKey.trim();
    saveOpenRouterApiKey(trimmed);
    updateLocalProfileState({ apiKey: trimmed, savedApiKey: trimmed });
    toast.success(trimmed ? 'Clave de OpenRouter guardada' : 'Clave de OpenRouter eliminada');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        updateLocalProfileState({ isLangDropdownOpen: false });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!folderSyncSupported) {
      return;
    }
    let isMounted = true;
    void loadLocalSyncDirectoryHandle()
      .then((handle) => {
        if (isMounted && handle) {
          updateLocalProfileState({ directoryHandle: handle });
        }
      })
      .catch((error) => {
        console.warn('[LocalFolderSync] No se pudo restaurar la carpeta:', error);
      });
    return () => {
      isMounted = false;
    };
  }, [folderSyncSupported]);

  const saveToFolder = async (handle: FileSystemDirectoryHandle) => {
    updateLocalProfileState({ isSyncingFolder: true });
    try {
      const result = await writeLocalFolderSnapshot(handle);
      updateLocalProfileState({ lastFolderSync: result.exportedAt });
      toast.success(`${t('folderSaved')} ${result.fileName}`);
    } catch (error) {
      console.error('[LocalFolderSync] Error al guardar datos:', error);
      toast.error(error instanceof Error ? error.message : t('folderSaveError'));
    } finally {
      updateLocalProfileState({ isSyncingFolder: false });
    }
  };

  const confirmFolderPermission = async (handle: FileSystemDirectoryHandle, toastId: string) => {
    toast.dismiss(toastId);
    updateLocalProfileState({ directoryHandle: handle });
    await saveLocalSyncDirectoryHandle(handle);
    await saveToFolder(handle);
  };

  const showFolderPermissionToast = (handle: FileSystemDirectoryHandle) => {
    toast.custom(
      (toastInstance) => (
        <div
          className={`oz-toast oz-dark max-w-md border border-[var(--color-primary)]/35 bg-[var(--bg-tertiary)] shadow-[var(--shadow-lg)] ${toastInstance.visible ? 'oz-enter' : 'oz-leave'}`}
        >
          <div className="flex items-start gap-3 p-4">
            <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-primary)]/35 bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <ShieldCheck size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    {t('folderPermissionTitle')}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                    {t('folderPermissionDescription')}{' '}
                    <span className="font-mono text-[var(--text-primary)]">
                      ozyrachat-data.json
                    </span>{' '}
                    {t('folderPermissionSuffix')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toast.dismiss(toastInstance.id)}
                  className="rounded-[var(--radius-sm)] p-1 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                  aria-label={t('close')}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void confirmFolderPermission(handle, toastInstance.id)}
                  className="atelier-btn-primary-sm"
                  disabled={isSyncingFolder}
                >
                  <Save size={14} />
                  {t('allowSaving')}
                </button>
                <button
                  type="button"
                  onClick={() => toast.dismiss(toastInstance.id)}
                  className="atelier-btn-secondary"
                  disabled={isSyncingFolder}
                >
                  {t('notNow')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
      { duration: Infinity }
    );
  };

  const chooseFolder = async () => {
    try {
      const handle = await pickLocalSyncDirectory();
      showFolderPermissionToast(handle);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }
      console.error('[LocalFolderSync] Error al elegir carpeta:', error);
      toast.error(error instanceof Error ? error.message : t('folderPickError'));
    }
  };

  const syncCurrentFolder = async () => {
    if (!directoryHandle) {
      await chooseFolder();
      return;
    }
    await saveToFolder(directoryHandle);
  };

  return (
    <div className="cfg-page">
      <div className="cfg-page-header">
        <h2 className="cfg-page-title">Perfil local</h2>
        <p className="cfg-page-desc">Idioma y almacenamiento local.</p>
      </div>

      {/* Idioma */}
      <div className="cfg-section">
        <div className="cfg-row">
          <div className="cfg-row-info">
            <span
              className="cfg-row-label"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              {t('language')}
            </span>
            <span className="cfg-row-hint">{t('languageDescription')}</span>
          </div>

          {/* Custom dropdown */}
          <div className="relative" style={{ width: '180px' }} ref={dropdownRef}>
            <button
              type="button"
              onClick={() => updateLocalProfileState({ isLangDropdownOpen: !isLangDropdownOpen })}
              className="cfg-btn"
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <span>
                {languageOptions.find((opt) => opt.code === language)?.nativeLabel || language}
              </span>
              <ChevronDown
                size={13}
                style={{
                  transition: 'transform 200ms',
                  transform: isLangDropdownOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>

            {isLangDropdownOpen && (
              <div className="local-profile-language-menu animate-slide-down">
                {languageOptions.map((option) => {
                  const isSelected = option.code === language;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => {
                        setLanguage(option.code);
                        updateLocalProfileState({ isLangDropdownOpen: false });
                      }}
                      className={`local-profile-language-option ${isSelected ? 'local-profile-language-option--selected' : ''}`}
                    >
                      {option.nativeLabel}
                      {isSelected && <Check size={13} style={{ color: 'var(--accent)' }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OpenRouter */}
      <div className="cfg-section">
        <span className="cfg-section-label">OpenRouter</span>
        <div className="cfg-row">
          <div className="cfg-row-info">
            <label
              htmlFor="openrouter-api-key"
              className="cfg-row-label"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <KeyRound size={14} />
              API key
            </label>
            <span className="cfg-row-hint">
              Se guarda en este navegador y es la clave que se usa para chatear. Consíguela en
              openrouter.ai/keys.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              id="openrouter-api-key"
              type="password"
              className="cfg-input"
              style={{ maxWidth: 280 }}
              value={apiKey}
              onChange={(event) => updateLocalProfileState({ apiKey: event.target.value })}
              placeholder="sk-or-v1-..."
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={saveApiKey}
              className="cfg-btn cfg-btn--primary"
              disabled={!apiKeyDirty}
            >
              <Save size={13} />
              Guardar
            </button>
          </div>
        </div>
      </div>

      {/* Almacenamiento */}
      <div className="cfg-section">
        <span className="cfg-section-label">{t('dataStorageTitle')}</span>

        <div className="cfg-row cfg-row--border">
          <div className="cfg-row-info">
            <span
              className="cfg-row-label"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Database size={14} />
              {t('storagePrimary').split(':')[0]}
            </span>
            <span className="cfg-row-hint">{t('storagePrimaryDescription')}</span>
          </div>
          <span className="cfg-badge cfg-badge--accent">
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: 'var(--text-primary)',
                display: 'inline-block',
              }}
            />
            Activo
          </span>
        </div>

        <div className={`cfg-row ${folderSyncSupported ? 'cfg-row--border' : ''}`}>
          <div className="cfg-row-info">
            <span
              className="cfg-row-label"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {directoryHandle ? (
                <CheckCircle2 size={14} style={{ color: 'var(--text-primary)' }} />
              ) : (
                <Folder size={14} />
              )}
              {t('folderCopy')}
            </span>
            <span className="cfg-row-hint">
              {!folderSyncSupported
                ? t('folderCopyUnsupported')
                : directoryHandle
                  ? `${t('folderCopyActive')}${lastFolderSync ? ` · ${new Date(lastFolderSync).toLocaleString()}` : ''}`
                  : t('folderCopyChoose')}
            </span>
          </div>
          {folderSyncSupported && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={chooseFolder}
                className="cfg-btn"
                disabled={isSyncingFolder}
              >
                <Folder size={13} />
                {directoryHandle ? t('changeFolder') : t('chooseFolder')}
              </button>
              {directoryHandle && (
                <button
                  type="button"
                  onClick={syncCurrentFolder}
                  className="cfg-btn cfg-btn--primary"
                  disabled={isSyncingFolder}
                >
                  <Save size={13} />
                  {isSyncingFolder ? t('saving') : t('saveNow')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocalProfileSection;
