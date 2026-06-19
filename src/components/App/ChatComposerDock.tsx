import type { ReactNode } from 'react';

interface ChatComposerDockProps {
  readonly children: ReactNode;
}

export function ChatComposerDock({ children }: ChatComposerDockProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[var(--bg-main)] via-[var(--bg-main)]/90 to-transparent z-10">
      <div className="max-w-3xl mx-auto px-6 pb-6 pt-10 relative">{children}</div>
    </div>
  );
}
