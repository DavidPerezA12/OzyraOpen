/**
 * CommandPalette Component
 *
 * Command Palette estilo VSCode/Spotlight para navegación rápida y acciones.
 * Activado con Ctrl+K / Cmd+K, permite buscar chats, ejecutar comandos,
 * cambiar configuraciones y más.
 *
 * Features:
 * - Búsqueda fuzzy de chats
 * - Comandos rápidos
 * - Navegación por teclado
 * - Categorías de acciones
 * - Historial de búsquedas
 * - Atajos visibles
 *
 * @module CommandPalette
 * @example
 * ```tsx
 * <CommandPalette
 *   isOpen={isCommandPaletteOpen}
 *   onClose={() => setIsCommandPaletteOpen(false)}
 *   chats={chats}
 *   onSelectChat={handleSelectChat}
 *   onExecuteCommand={handleCommand}
 * />
 * ```
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  MessageSquare,
  Plus,
  Settings,
  Download,
  Trash2,
  Moon,
  Sun,
  Zap,
  Command,
  ArrowRight,
  Clock,
  ChevronRight,
} from 'lucide-react';
import type { Chat } from '../../types';

/**
 * Tipos de comandos disponibles
 */
type CommandType = 'navigation' | 'action' | 'setting' | 'chat' | 'recent';

/**
 * Definición de un comando
 */
interface Command {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  type: CommandType;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

/**
 * Props para el componente CommandPalette
 */
interface CommandPaletteProps {
  /** Indica si el palette está abierto */
  isOpen: boolean;
  /** Callback para cerrar el palette */
  onClose: () => void;
  /** Lista de chats disponibles */
  chats?: Chat[];
  /** Callback al seleccionar un chat */
  onSelectChat?: (chatId: string) => void;
  /** Callback al ejecutar un comando */
  onExecuteCommand?: (commandId: string) => void;
  /** Comandos personalizados adicionales */
  customCommands?: Command[];
  /** Indica si el modo oscuro está activado */
  isDarkMode?: boolean;
}

const EMPTY_CHATS: Chat[] = [];
const EMPTY_COMMANDS: Command[] = [];

const fuzzyMatch = (text: string, query: string): { matches: boolean; score: number } => {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  if (textLower === queryLower) {
    return { matches: true, score: 100 };
  }
  if (textLower.startsWith(queryLower)) {
    return { matches: true, score: 90 };
  }
  if (textLower.includes(queryLower)) {
    return { matches: true, score: 70 };
  }

  let queryIndex = 0;
  const matchPositions: number[] = [];
  for (let index = 0; index < textLower.length && queryIndex < queryLower.length; index++) {
    if (textLower[index] === queryLower[queryIndex]) {
      matchPositions.push(index);
      queryIndex++;
    }
  }

  if (queryIndex !== queryLower.length) {
    return { matches: false, score: 0 };
  }

  const averageDistance =
    matchPositions.length > 1
      ? matchPositions.reduce(
          (sum, position, index, positions) =>
            index > 0 ? sum + (position - positions[index - 1]) : sum,
          0
        ) /
        (matchPositions.length - 1)
      : 0;
  return { matches: true, score: Math.max(30, 60 - averageDistance * 2) };
};

interface IndexedCommand {
  command: Command;
  index: number;
}

interface CommandGroupProps {
  title: string;
  commands: IndexedCommand[];
  icon?: React.ComponentType<{ className?: string }>;
  selectedIndex: number;
  resultRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  onSelectedIndexChange: (index: number) => void;
}

const CommandGroup: React.FC<CommandGroupProps> = ({
  title,
  commands,
  icon: GroupIcon,
  selectedIndex,
  resultRefs,
  onSelectedIndexChange,
}) => {
  if (commands.length === 0) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-[var(--text-muted)]">
        {GroupIcon && <GroupIcon className="w-3 h-3" />}
        {title}
      </div>
      <div className="space-y-1 px-2">
        {commands.map(({ command, index }) => {
          const Icon = command.icon;
          const isSelected = index === selectedIndex;
          return (
            <button
              key={command.id}
              ref={(element) => {
                resultRefs.current[index] = element;
              }}
              type="button"
              data-index={index}
              onClick={command.action}
              onMouseEnter={() => onSelectedIndexChange(index)}
              className={`palette-item group ${isSelected ? 'palette-item--selected' : ''}`}
            >
              <Icon className="w-5 h-5 flex-shrink-0 text-[var(--color-primary)]" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-[var(--text-primary)]">
                  {command.label}
                </div>
                {command.description && (
                  <div className="text-xs truncate text-[var(--text-muted)]">
                    {command.description}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {command.shortcut && <kbd className="palette-kbd">{command.shortcut}</kbd>}
                {isSelected && <ChevronRight className="w-4 h-4 text-[var(--color-primary)]" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

interface UseCommandPaletteCommandsParams {
  query: string;
  chats: readonly Chat[];
  customCommands: readonly Command[];
  isDarkMode: boolean;
  onClose: () => void;
  onSelectChat?: (chatId: string) => void;
  onExecuteCommand?: (commandId: string) => void;
}

const useCommandPaletteCommands = ({
  query,
  chats,
  customCommands,
  isDarkMode,
  onClose,
  onSelectChat,
  onExecuteCommand,
}: UseCommandPaletteCommandsParams) => {
  const defaultCommands = useMemo<Command[]>(
    () => [
      {
        id: 'new-chat',
        label: 'Crear nuevo chat',
        description: 'Iniciar una nueva conversación',
        icon: Plus,
        type: 'action',
        shortcut: 'Ctrl+N',
        action: () => {
          onExecuteCommand?.('new-chat');
          onClose();
        },
        keywords: ['nuevo', 'crear', 'chat', 'conversación'],
      },
      {
        id: 'settings',
        label: 'Abrir configuración',
        description: 'Ajustar preferencias de la aplicación',
        icon: Settings,
        type: 'navigation',
        shortcut: 'Ctrl+,',
        action: () => {
          onExecuteCommand?.('settings');
          onClose();
        },
        keywords: ['configuración', 'ajustes', 'preferencias', 'settings'],
      },
      {
        id: 'export-chat',
        label: 'Exportar chat actual',
        description: 'Descargar conversación en varios formatos',
        icon: Download,
        type: 'action',
        action: () => {
          onExecuteCommand?.('export');
          onClose();
        },
        keywords: ['exportar', 'descargar', 'guardar', 'download'],
      },
      {
        id: 'delete-chat',
        label: 'Eliminar chat',
        description: 'Borrar la conversación actual',
        icon: Trash2,
        type: 'action',
        action: () => {
          onExecuteCommand?.('delete');
          onClose();
        },
        keywords: ['eliminar', 'borrar', 'delete'],
      },
      {
        id: 'toggle-theme',
        label: 'Cambiar tema',
        description: 'Alternar entre modo claro y oscuro',
        icon: isDarkMode ? Sun : Moon,
        type: 'setting',
        action: () => {
          onExecuteCommand?.('toggle-theme');
          onClose();
        },
        keywords: ['tema', 'theme', 'oscuro', 'claro', 'dark', 'light'],
      },
    ],
    [isDarkMode, onClose, onExecuteCommand]
  );

  const allCommands = useMemo(
    () => [...defaultCommands, ...customCommands],
    [customCommands, defaultCommands]
  );

  const chatCommands = useMemo<Command[]>(
    () =>
      chats.map((chat) => ({
        id: `chat-${chat.id}`,
        label: chat.title || 'Sin título',
        description: `${chat.messages.length} mensajes`,
        icon: MessageSquare,
        type: 'chat',
        action: () => {
          onSelectChat?.(chat.id);
          onClose();
        },
        keywords: [
          chat.title || '',
          ...chat.messages.map((message) => message.content.substring(0, 50)),
        ],
      })),
    [chats, onClose, onSelectChat]
  );

  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return [...allCommands.slice(0, 6), ...chatCommands.slice(0, 4)];
    }

    const searchQuery = query.trim();
    const scoreCommand = (command: Command, keywordWeight: number, descriptionWeight: number) => {
      const labelMatch = fuzzyMatch(command.label, searchQuery);
      const descriptionMatch = fuzzyMatch(command.description || '', searchQuery);
      const keywordMatch = command.keywords?.reduce(
        (best, keyword) => {
          const match = fuzzyMatch(keyword, searchQuery);
          return match.score > best.score ? match : best;
        },
        { matches: false, score: 0 }
      );

      return Math.max(
        labelMatch.score,
        descriptionMatch.score * descriptionWeight,
        (keywordMatch?.score || 0) * keywordWeight
      );
    };

    const scoredCommands = allCommands.flatMap((command) => {
      const score = scoreCommand(command, 0.5, 0.7);
      return score > 25 ? [{ command, score }] : [];
    });
    const scoredChats = chatCommands.flatMap((command) => {
      const score = scoreCommand(command, 0.6, 0);
      return score > 25 ? [{ command, score }] : [];
    });

    return [...scoredCommands, ...scoredChats]
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((item) => item.command);
  }, [allCommands, chatCommands, query]);

  const groupedCommands = useMemo(() => {
    const groups: Record<CommandType, IndexedCommand[]> = {
      recent: [],
      action: [],
      navigation: [],
      setting: [],
      chat: [],
    };

    filteredCommands.forEach((command, index) => {
      groups[command.type].push({ command, index });
    });

    return groups;
  }, [filteredCommands]);

  return { filteredCommands, groupedCommands };
};

/**
 * Componente CommandPalette
 */
type CommandPaletteDialogProps = Omit<CommandPaletteProps, 'isOpen'>;

const CommandPaletteDialog: React.FC<CommandPaletteDialogProps> = ({
  onClose,
  chats = EMPTY_CHATS,
  onSelectChat,
  onExecuteCommand,
  customCommands = EMPTY_COMMANDS,
  isDarkMode = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const showRecent = !query.trim();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { filteredCommands, groupedCommands } = useCommandPaletteCommands({
    query,
    chats,
    customCommands,
    isDarkMode,
    onClose,
    onSelectChat,
    onExecuteCommand,
  });

  /**
   * Scroll automático al elemento seleccionado
   */
  const handleSelectedIndexChange = useCallback((nextIndex: number) => {
    setSelectedIndex(nextIndex);
    const selectedElement = resultRefs.current[nextIndex];
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  /**
   * Navegación por teclado
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          handleSelectedIndexChange(Math.min(selectedIndex + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleSelectedIndexChange(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            if (query.trim()) {
              setRecentSearches((prev) => [query, ...prev.filter((q) => q !== query).slice(0, 4)]);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, handleSelectedIndexChange, onClose, query, selectedIndex]
  );

  /**
   * Ocultar recientes cuando hay query
   */
  const handleQueryChange = useCallback((nextQuery: string) => {
    setQuery(nextQuery);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) {
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    }
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      window.clearTimeout(focusTimer);
      if (dialog?.open && typeof dialog.close === 'function') {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Paleta de comandos"
      className="fixed inset-0 z-[100] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar paleta de comandos"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-fade-in"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed inset-0 flex items-start justify-center pt-[10vh] z-[101] px-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-2xl animate-slide-down">
          <div className="palette-panel">
            <div className="palette-search-bar">
              <Command className="w-5 h-5 text-[var(--color-primary)]" />
              <input
                ref={inputRef}
                type="text"
                aria-label="Buscar chats y comandos"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar chats, comandos, configuración..."
                className="flex-1 bg-transparent outline-none text-base font-medium text-[var(--text-primary)] placeholder-[var(--text-muted)]"
              />
              <kbd className="palette-kbd">ESC</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[28rem] overflow-y-auto py-3 custom-scrollbar">
              {/* Búsquedas recientes */}
              {showRecent && recentSearches.length > 0 && (
                <div className="mb-4 px-2">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div
                      className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wider ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      Recientes
                    </div>
                    <button
                      type="button"
                      onClick={() => setRecentSearches([])}
                      className={`text-xs ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-gray-300'
                          : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      Limpiar
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.slice(0, 3).map((search) => (
                      <button
                        key={search}
                        type="button"
                        onClick={() => handleQueryChange(search)}
                        className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg
                        text-left transition-colors text-sm
                        ${
                          isDarkMode
                            ? 'hover:bg-gray-800 text-gray-400'
                            : 'hover:bg-gray-100 text-gray-600'
                        }
                      `}
                      >
                        <Clock className="w-4 h-4" />
                        {search}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center">
                  <Search
                    className={`w-12 h-12 mx-auto mb-3 ${
                      isDarkMode ? 'text-gray-600' : 'text-gray-300'
                    }`}
                  />
                  <p className={`font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No se encontraron resultados
                  </p>
                  <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Intenta con otros términos de búsqueda
                  </p>
                </div>
              ) : (
                <>
                  <CommandGroup
                    title="Acciones"
                    commands={groupedCommands.action}
                    icon={Zap}
                    selectedIndex={selectedIndex}
                    resultRefs={resultRefs}
                    onSelectedIndexChange={handleSelectedIndexChange}
                  />
                  <CommandGroup
                    title="Navegación"
                    commands={groupedCommands.navigation}
                    icon={ArrowRight}
                    selectedIndex={selectedIndex}
                    resultRefs={resultRefs}
                    onSelectedIndexChange={handleSelectedIndexChange}
                  />
                  <CommandGroup
                    title="Configuración"
                    commands={groupedCommands.setting}
                    icon={Settings}
                    selectedIndex={selectedIndex}
                    resultRefs={resultRefs}
                    onSelectedIndexChange={handleSelectedIndexChange}
                  />
                  <CommandGroup
                    title="Chats"
                    commands={groupedCommands.chat}
                    icon={MessageSquare}
                    selectedIndex={selectedIndex}
                    resultRefs={resultRefs}
                    onSelectedIndexChange={handleSelectedIndexChange}
                  />
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <kbd className="palette-kbd">↑</kbd>
                  <kbd className="palette-kbd">↓</kbd>
                  <span>navegar</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="palette-kbd">↵</kbd>
                  <span>seleccionar</span>
                </span>
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                {filteredCommands.length} resultado{filteredCommands.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, ...dialogProps }) =>
  isOpen ? <CommandPaletteDialog {...dialogProps} /> : null;
