import { Loader2, Sparkles } from 'lucide-react';

interface ChatCustomizationPanelProps {
  readonly value: string;
  readonly setValue: (input: string) => void;
  readonly setShowChatCustomization: (show: boolean) => void;
  readonly handleSaveChatCustomization: () => void;
  readonly handleImproveChatCustomization: () => void;
  readonly isImprovingChatCustomization: boolean;
}

export const ChatCustomizationPanel = ({
  value,
  setValue,
  setShowChatCustomization,
  handleSaveChatCustomization,
  handleImproveChatCustomization,
  isImprovingChatCustomization,
}: ChatCustomizationPanelProps) => (
  <div className="mb-3 atelier-card p-4 animate-slide-up">
    <div className="mb-2.5 flex items-center justify-between">
      <h4 className="text-sm font-medium text-[var(--text-primary)]">Personalizar este chat</h4>
    </div>
    <div className="space-y-2.5">
      <p className="text-xs text-[var(--text-secondary)]">
        Agrega instrucciones específicas para personalizar el asistente en esta conversación
      </p>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Por ejemplo: Actúa como un experto en marketing, explica conceptos como si le hablaras a un principiante, sé conciso en tus respuestas..."
        aria-label="Instrucciones específicas del chat"
        className="w-full p-3 rounded-[var(--radius-md)] border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-soft)] text-sm custom-scrollbar"
        rows={3}
      />
    </div>
    <div className="mt-3 flex items-center justify-between">
      <div>
        <button
          type="button"
          onClick={handleImproveChatCustomization}
          disabled={isImprovingChatCustomization}
          className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-secondary)] text-white hover:opacity-90 text-xs font-medium transition-opacity flex items-center gap-1.5"
          title="Mejorar con IA"
        >
          {isImprovingChatCustomization ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5" />
          )}
          <span>Mejorar</span>
        </button>
      </div>
      <div className="flex justify-end space-x-2">
        <button
          type="button"
          onClick={() => setShowChatCustomization(false)}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--border-primary)] hover:bg-[var(--color-primary-soft)] text-[var(--text-primary)] text-xs font-medium transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSaveChatCustomization}
          className="px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-[var(--bg-primary)] hover:shadow-[var(--shadow-glow)] text-xs font-medium transition-all"
        >
          Guardar
        </button>
      </div>
    </div>
  </div>
);
