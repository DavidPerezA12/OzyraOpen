import React, { Suspense } from 'react';
import type { Chat } from '../../types';

// Overlays pesados que solo se usan bajo demanda (atajos de teclado): fuera
// del bundle inicial.
const AdvancedSearch = React.lazy(() =>
  import('../ui/AdvancedSearch').then((module) => ({ default: module.AdvancedSearch }))
);
const CommandPalette = React.lazy(() =>
  import('../ui/CommandPalette').then((module) => ({ default: module.CommandPalette }))
);

const EMPTY_FAVORITES = new Set<string>();

interface AppInteractionOverlaysProps {
  readonly showAdvancedSearch: boolean;
  readonly showCommandPalette: boolean;
  readonly chats: readonly Chat[];
  readonly availableModelIds: string[];
  readonly isDarkMode: boolean;
  readonly favorites?: Set<string>;
  readonly onToggleFavorite?: (chatId: string) => void;
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
  favorites = EMPTY_FAVORITES,
  onToggleFavorite,
  onCloseAdvancedSearch,
  onAdvancedSearchSelect,
  onCloseCommandPalette,
  onCommandPaletteSelect,
  onCommandPaletteAction,
}: AppInteractionOverlaysProps) {
  return (
    <>
      {showAdvancedSearch && (
        <Suspense fallback={null}>
          <AdvancedSearch
            isOpen={showAdvancedSearch}
            onClose={onCloseAdvancedSearch}
            chats={chats}
            favorites={favorites ?? EMPTY_FAVORITES}
            onToggleFavorite={onToggleFavorite}
            onSelectChat={onAdvancedSearchSelect}
            availableModels={availableModelIds}
            isDarkMode={isDarkMode}
          />
        </Suspense>
      )}

      {showCommandPalette && (
        <Suspense fallback={null}>
          <CommandPalette
            isOpen={showCommandPalette}
            onClose={onCloseCommandPalette}
            chats={chats}
            onSelectChat={onCommandPaletteSelect}
            onExecuteCommand={onCommandPaletteAction}
            isDarkMode={isDarkMode}
          />
        </Suspense>
      )}
    </>
  );
}
