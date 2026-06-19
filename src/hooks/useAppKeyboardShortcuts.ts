import { useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react';

interface UseAppKeyboardShortcutsParams {
  readonly setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  readonly setShowAdvancedSearch: Dispatch<SetStateAction<boolean>>;
  readonly setShowCommandPalette: Dispatch<SetStateAction<boolean>>;
  readonly textareaRef: RefObject<HTMLTextAreaElement>;
}

export function useAppKeyboardShortcuts({
  setSidebarOpen,
  setShowAdvancedSearch,
  setShowCommandPalette,
  textareaRef,
}: UseAppKeyboardShortcutsParams): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'b') {
        event.preventDefault();
        setSidebarOpen((prevState) => !prevState);
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        setShowAdvancedSearch(true);
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setShowCommandPalette(true);
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const activeElement = document.activeElement as HTMLElement | null;
        const tag = (activeElement?.tagName || '').toLowerCase();
        const isTyping =
          tag === 'input' || tag === 'textarea' || Boolean(activeElement?.isContentEditable);
        if (!isTyping) {
          event.preventDefault();
          textareaRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setShowAdvancedSearch, setShowCommandPalette, setSidebarOpen, textareaRef]);
}
