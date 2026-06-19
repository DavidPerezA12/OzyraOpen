import { Plus } from 'lucide-react';

interface CollapsedChatActionsProps {
  readonly onOpenSidebar: () => void;
  readonly onNewChat: () => void;
}

export function CollapsedChatActions({ onOpenSidebar, onNewChat }: CollapsedChatActionsProps) {
  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="p-1.5 rounded-md transition-colors"
        style={{ color: 'var(--text-muted)', background: 'transparent' }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = 'var(--bg-hover)';
          event.currentTarget.style.color = 'var(--text-primary)';
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = 'transparent';
          event.currentTarget.style.color = 'var(--text-muted)';
        }}
        aria-label="Abrir barra lateral"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onNewChat}
        className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
        style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
        aria-label="Nueva conversación"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
