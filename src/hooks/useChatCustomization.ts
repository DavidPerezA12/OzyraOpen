import { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { t } from '../i18n';
import { chatService } from '../services/chatService';
import type { ChatStore } from '../state/chatStore';
import { updateChatCustomizationPrompt } from '../utils/db';
import { logger } from '../utils/logger';

const IMPROVE_CUSTOMIZATION_MODEL = 'google/gemini-2.0-flash-exp:free';

const IMPROVE_CUSTOMIZATION_SYSTEM_PROMPT = `Convierte esta descripción en un prompt del sistema claro y conciso para un asistente de chat.

Requisitos:
- Define el rol y objetivo principal
- Especifica el estilo y tono de respuesta
- Mantén el resultado entre 50-150 palabras
- Escribe en español y sin formato especial

Devuelve solo el prompt final, sin comillas ni explicaciones.`;

const cleanImprovedPrompt = (value: string): string =>
  value
    .replace(/^```[a-zA-Z]*\n?/i, '')
    .replace(/```$/i, '')
    .replace(/^"+|"+$/g, '')
    .trim();

export interface ChatCustomizationController {
  readonly isOpen: boolean;
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  readonly isImproving: boolean;
  readonly toggle: () => void;
  readonly close: () => void;
  readonly save: () => Promise<void>;
  readonly improve: () => Promise<void>;
}

/** Panel de personalización (prompt de sistema) del chat activo. */
export function useChatCustomization(store: ChatStore): ChatCustomizationController {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const isImprovingRef = useRef(false);

  const close = useCallback(() => setIsOpen(false), []);

  const toggle = useCallback(() => {
    const chat = store.getCurrentChat();
    if (!chat) {
      return;
    }
    if (!isOpen) {
      setDraft(chat.customizationPrompt ?? '');
    }
    setIsOpen(!isOpen);
  }, [isOpen, store]);

  const save = useCallback(async () => {
    const chat = store.getCurrentChat();
    if (!chat) {
      return;
    }

    const customizationPrompt = draft.trim() || undefined;
    if (chat.isPersisted) {
      try {
        await updateChatCustomizationPrompt(chat.id, customizationPrompt ?? null);
      } catch (error) {
        logger.error('Error al guardar personalización local:', error);
        toast.error(t('customizationSaveError'));
        return;
      }
    }

    store.updateChat(chat.id, (current) => ({ ...current, customizationPrompt }));
    setIsOpen(false);
  }, [draft, store]);

  const improve = useCallback(async () => {
    const brief = draft.trim();
    if (!brief || isImprovingRef.current) {
      return;
    }

    try {
      isImprovingRef.current = true;
      setIsImproving(true);

      const response = await chatService.createChatCompletion({
        model: IMPROVE_CUSTOMIZATION_MODEL,
        messages: [
          { role: 'system', content: IMPROVE_CUSTOMIZATION_SYSTEM_PROMPT },
          { role: 'user', content: `Descripción: ${brief}` },
        ],
        temperature: 0.4,
        max_tokens: 400,
      });

      const improved = response?.choices?.[0]?.message?.content?.trim();
      if (improved) {
        setDraft(cleanImprovedPrompt(improved));
      } else {
        toast.error(t('customizationImproveError'));
      }
    } catch (error) {
      logger.error('Error mejorando personalización:', error);
      toast.error(t('customizationImproveAiError'));
    } finally {
      isImprovingRef.current = false;
      setIsImproving(false);
    }
  }, [draft]);

  return { isOpen, draft, setDraft, isImproving, toggle, close, save, improve };
}
