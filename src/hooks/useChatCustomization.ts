import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import toast from 'react-hot-toast';
import { chatService } from '../services/chatService';
import type { Chat } from '../types';
import { updateChatCustomizationPrompt } from '../utils/db';

interface UseChatCustomizationParams {
  readonly currentChat: Chat | null;
  readonly setCurrentChat: Dispatch<SetStateAction<Chat | null>>;
  readonly setChats: Dispatch<SetStateAction<Chat[]>>;
  readonly userId: string | null;
  readonly showChatCustomization: boolean;
  readonly setShowChatCustomization: Dispatch<SetStateAction<boolean>>;
  readonly currentChatCustomizationInput: string;
  readonly setCurrentChatCustomizationInput: Dispatch<SetStateAction<string>>;
  readonly setIsImprovingChatCustomization: Dispatch<SetStateAction<boolean>>;
}

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

export function useChatCustomization({
  currentChat,
  setCurrentChat,
  setChats,
  userId,
  showChatCustomization,
  setShowChatCustomization,
  currentChatCustomizationInput,
  setCurrentChatCustomizationInput,
  setIsImprovingChatCustomization,
}: UseChatCustomizationParams) {
  const isImprovingRef = useRef(false);

  const toggleChatCustomizationPopup = useCallback(() => {
    if (!currentChat) {
      return;
    }
    if (!showChatCustomization) {
      setCurrentChatCustomizationInput(currentChat.customizationPrompt || '');
    }
    setShowChatCustomization(!showChatCustomization);
  }, [
    currentChat,
    setCurrentChatCustomizationInput,
    setShowChatCustomization,
    showChatCustomization,
  ]);

  const handleSaveChatCustomization = useCallback(async () => {
    if (!currentChat) {
      return;
    }

    const updatedChat = {
      ...currentChat,
      customizationPrompt: currentChatCustomizationInput.trim() || undefined,
    };
    if (userId && updatedChat.isPersisted) {
      try {
        await updateChatCustomizationPrompt(
          updatedChat.id,
          updatedChat.customizationPrompt ?? null
        );
      } catch (error) {
        console.error('Error al guardar personalización local:', error);
        toast.error('No se pudo guardar la personalización');
        return;
      }
    }

    setCurrentChat(updatedChat);
    setChats((currentChats) =>
      currentChats.map((chat) => (chat.id === currentChat.id ? updatedChat : chat))
    );
    setShowChatCustomization(false);
  }, [
    currentChat,
    currentChatCustomizationInput,
    setChats,
    setCurrentChat,
    setShowChatCustomization,
    userId,
  ]);

  const handleImproveChatCustomization = useCallback(async () => {
    const brief = currentChatCustomizationInput.trim();
    if (!brief || isImprovingRef.current) {
      return;
    }

    try {
      isImprovingRef.current = true;
      setIsImprovingChatCustomization(true);

      const response = await chatService.createChatCompletion({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          { role: 'system', content: IMPROVE_CUSTOMIZATION_SYSTEM_PROMPT },
          { role: 'user', content: `Descripción: ${brief}` },
        ],
        temperature: 0.4,
        max_tokens: 400,
      });

      const improved = response?.choices?.[0]?.message?.content?.trim();
      if (improved) {
        setCurrentChatCustomizationInput(cleanImprovedPrompt(improved));
      } else {
        toast.error('No se pudo mejorar la personalización');
      }
    } catch (error) {
      console.error('Error mejorando personalización:', error);
      toast.error('Error al mejorar con IA');
    } finally {
      isImprovingRef.current = false;
      setIsImprovingChatCustomization(false);
    }
  }, [
    currentChatCustomizationInput,
    setCurrentChatCustomizationInput,
    setIsImprovingChatCustomization,
  ]);

  return {
    toggleChatCustomizationPopup,
    handleSaveChatCustomization,
    handleImproveChatCustomization,
  } as const;
}
