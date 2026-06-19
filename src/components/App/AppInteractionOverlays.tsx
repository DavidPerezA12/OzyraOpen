import { AdvancedSearch } from '../ui/AdvancedSearch';
import { CommandPalette } from '../ui/CommandPalette';
import type { Chat } from '../../types';

const EMPTY_FAVORITES = new Set<string>();

interface AppInteractionOverlaysProps {
  readonly showAdvancedSearch: boolean;
  readonly showCommandPalette: boolean;
  readonly chats: Chat[];
  readonly availableModelIds: string[];
  readonly isDarkMode: boolean;
  readonly onCloseAdvancedSearch: () => void;
  readonly onAdvancedSearchSelect: (chatId: string) => void;
  readonly onCloseCommandPalette: () => void;
  readonly onCommandPaletteSelect: (chatId: string) => void;
  readonly onCommandPaletteAction: (commandId: string) => void;
}

export function AppInteractionOverlays({
  showAdvancedSearch,
  showCommandPalette,
  chats,
  availableModelIds,
  isDarkMode,
  onCloseAdvancedSearch,
  onAdvancedSearchSelect,
  onCloseCommandPalette,
  onCommandPaletteSelect,
  onCommandPaletteAction,
}: AppInteractionOverlaysProps) {
  return (
    <>
      {showAdvancedSearch && (
        <AdvancedSearch
          isOpen={showAdvancedSearch}
          onClose={onCloseAdvancedSearch}
          chats={chats}
          favorites={EMPTY_FAVORITES}
          onSelectChat={onAdvancedSearchSelect}
          availableModels={availableModelIds}
          isDarkMode={isDarkMode}
        />
      )}

      {showCommandPalette && (
        <CommandPalette
          isOpen={showCommandPalette}
          onClose={onCloseCommandPalette}
          chats={chats}
          onSelectChat={onCommandPaletteSelect}
          onExecuteCommand={onCommandPaletteAction}
          isDarkMode={isDarkMode}
        />
      )}
    </>
  );
}
