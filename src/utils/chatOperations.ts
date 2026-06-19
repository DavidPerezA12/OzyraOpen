/**
 * Chat Operations Utilities
 *
 * Funciones auxiliares para operaciones de chat como:
 * - Generación de títulos automáticos
 * - Seguimiento local de uso
 * - Preparación de mensajes para API
 */

import { chatService, type ChatCompletionRequest } from '../services/chatService';
import type { Chat, Message } from '../types';

/**
 * Genera un título automático para un chat basado en el primer mensaje
 */
export async function generateChatTitle(
  userInput: string,
  userId: string | null
): Promise<string | null> {
  try {
    if (!userId) {
      console.info('No hay perfil local activo; se omite la generación de título');
      return null;
    }

    const baseMessages = [
      {
        role: 'system' as const,
        content:
          'Genera un título corto y descriptivo (en torno a 4-5 palabras) para una conversación basado en el siguiente mensaje. Responde SOLO con el título, sin comillas ni puntos finales.',
      },
      {
        role: 'user' as const,
        content: userInput,
      },
    ];

    // Modelos a intentar (con fallback si alguno falla)
    const candidateModels = [
      'google/gemini-2.0-flash-exp:free',
      'deepseek/deepseek-chat-v3.1:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1-0528-qwen3-8b:free',
    ];

    let titleResponse = null;
    let lastError: unknown = null;

    for (const modelId of candidateModels) {
      try {
        titleResponse = await chatService.createChatCompletion({
          messages: baseMessages,
          model: modelId,
          temperature: 0.7,
          max_tokens: 50,
        });
        break; // éxito
      } catch (err: unknown) {
        lastError = err;
        console.warn(`[generateChatTitle] Fallback: falló modelo ${modelId}`, err);
        continue;
      }
    }

    if (!titleResponse) {
      throw lastError instanceof Error
        ? lastError
        : new Error('No se pudo generar título con los modelos de fallback');
    }

    const generatedTitle = titleResponse.choices?.[0]?.message?.content?.trim();
    return generatedTitle || null;
  } catch (error) {
    console.error('Error al generar título automático:', error);
    return null;
  }
}

/**
 * Normaliza el role de un mensaje para la API
 */
export function normalizeMessageRole(
  role: Message['role']
): ChatCompletionRequest['messages'][number]['role'] {
  return role === 'model' ? 'assistant' : role;
}

/**
 * Prepara los mensajes del sistema para incluir preferencias y personalización
 */
export function prepareSystemMessages(
  chat: Chat,
  preferences?: {
    userName?: string;
    userKnowledge?: string;
    userTraits?: string;
    userAdditionalInfo?: string;
  }
): Array<{ role: 'system'; content: string }> {
  const systemMessages: Array<{ role: 'system'; content: string }> = [];

  // Agregar preferencias de usuario si existen
  if (
    preferences?.userName ||
    preferences?.userKnowledge ||
    preferences?.userTraits ||
    preferences?.userAdditionalInfo
  ) {
    systemMessages.push({
      role: 'system',
      content: `Información del usuario:\n${
        preferences.userName ? `Nombre: ${preferences.userName}\n` : ''
      }${preferences.userKnowledge ? `Conocimientos: ${preferences.userKnowledge}\n` : ''}${
        preferences.userTraits ? `Características: ${preferences.userTraits}\n` : ''
      }${preferences.userAdditionalInfo ? `Información adicional: ${preferences.userAdditionalInfo}` : ''}`.trim(),
    });
  }

  // Agregar personalización del chat si existe
  if (chat.customizationPrompt) {
    systemMessages.push({
      role: 'system',
      content: chat.customizationPrompt,
    });
  }

  return systemMessages;
}

/**
 * Obtiene información del modelo y su tier
 */
// getModelInfo se debe importar desde config/models para evitar duplicación

/**
 * Exporta un chat a formato JSON
 */
export function exportChatToJSON(chat: Chat): void {
  const exportData = {
    ...chat,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ozyra-chat-${chat.title.replace(/[^a-z0-9]/gi, '_')}-${chat.id.slice(-5)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
