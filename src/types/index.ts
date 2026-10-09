/**
 * Types Index
 *
 * Definiciones de tipos centralizadas para la aplicación Ozyra Open.
 *
 * Este módulo contiene todas las interfaces, tipos y definiciones
 * utilizadas en toda la aplicación para asegurar consistencia
 * y type safety.
 *
 * Categorías de tipos incluidas:
 * - Tipos de mensajes y conversaciones
 * - Información y capacidades de modelos
 * - Estados de razonamiento y chat
 * - Preferencias de usuario y configuración
 * - Estadísticas de uso y límites
 * - Tipos de archivos adjuntos y anotaciones
 *
 * @module Types
 * @example
 * ```tsx
 * import type { Message, Chat, ModelInfo } from '../types';
 *
 * // Usar tipos en componentes
 * const message: Message = {
 *   id: '123',
 *   role: 'user',
 *   content: 'Hola',
 *   timestamp: Date.now()
 * };
 *
 * const chat: Chat = {
 *   id: '456',
 *   title: 'Mi Chat',
 *   messages: [message],
 *   createdAt: Date.now(),
 *   model: 'gpt-4'
 * };
 * ```
 */

import type { ElementType } from 'react';

export type UploadedImage = {
  url: string;
  contentType: string;
  data?: string;
};

// ============================================================================
// CORE MESSAGE TYPES
// ============================================================================

/** Roles that can send messages in a conversation */
type MessageRole = 'user' | 'assistant' | 'model';

/** Types of attachments that can be included in messages */
type AttachmentType = 'image' | 'file';

/** Types of annotations that can be applied to message content */
type AnnotationType = 'url_citation';

/**
 * URL citation annotation details
 */
interface UrlCitation {
  /** URL of the cited source */
  readonly url: string;
  /** Title of the cited source */
  readonly title: string;
  /** Optional snippet of content from the source */
  readonly content?: string;
  /** Confidence score of the citation (0-100) */
  readonly confidence?: number;
  /** Start index of the cited text in the message content */
  readonly start_index?: number;
  /** End index of the cited text in the message content */
  readonly end_index?: number;
}

/**
 * Annotation within message content
 */
export interface MessageAnnotation {
  /** Type of annotation */
  readonly type: AnnotationType;
  /** Details specific to URL citation annotation */
  readonly url_citation: UrlCitation;
}

/**
 * File or image attachment
 */
export interface MessageAttachment {
  /** Type of attachment */
  readonly type: AttachmentType;
  /** URL where the attachment can be accessed */
  readonly url: string;
  /** Name of the attached file or image */
  readonly name: string;
  /** MIME type of the attachment */
  readonly contentType?: string;
  /** Base64 encoded data for inline content */
  readonly data?: string;
}

/**
 * Represents a single message within a chat conversation
 */
export interface Message {
  /** Unique identifier for the message */
  readonly id: string;
  /** The role of the sender */
  readonly role: MessageRole;
  /** The textual content of the message */
  readonly content: string;
  /** Timestamp when the message was created (milliseconds since epoch) */
  readonly timestamp: number;
  /** ID of the AI model used to generate the message */
  readonly model?: string;
  /** Optional "thinking" process content before generating the final response */
  readonly thinkingContent?: string;
  /** Flag indicating if web search was used */
  readonly useWebSearch?: boolean;
  /** List of search queries used if web search was enabled */
  readonly searchQueries?: readonly string[];
  /** Annotations within the message content */
  readonly annotations?: readonly MessageAnnotation[];
  /** Files or images attached to the message */
  readonly attachments?: readonly MessageAttachment[];
}

// ============================================================================
// MODEL TYPES
// ============================================================================

/** Available model tiers */
export type ModelTier = 'standard' | 'premium';

/**
 * Model capabilities configuration
 */
export interface ModelCapabilities {
  /** Optimized for low latency */
  readonly fast: boolean;
  /** Image understanding (accepts image attachments) */
  readonly vision: boolean;
  /** Advanced reasoning capabilities */
  readonly reasoning: boolean;
  /** Supports effort-level control for reasoning (low/medium/high) */
  readonly effortControl: boolean;
  /** Tool calling integrations */
  readonly toolCalling: boolean;
  /** Image generation capabilities */
  readonly imageGeneration: boolean;
  /** Advanced PDF/document comprehension */
  readonly pdfComprehension: boolean;
  /** Extended thinking phase support */
  readonly thinking: boolean;
  /** Works with OpenRouter web search */
  readonly webSearch: boolean;
}

/**
 * Model pricing information
 */
export interface ModelPricing {
  /** Cost per million input tokens (USD) */
  readonly input: number;
  /** Cost per million output tokens (USD) */
  readonly output: number;
}

/**
 * Serializable model metadata (what the catalog cache stores)
 */
export interface ModelDefinition {
  /** Unique model identifier */
  readonly id: string;
  /** Display name of the model */
  readonly name: string;
  /** Icon key: provider id (`anthropic`) or path to a custom SVG */
  readonly iconKey: string;
  /** Human-readable provider name */
  readonly displayProviderName: string;
  /** Model tier (standard/premium) */
  readonly tier: ModelTier;
  /** Model description */
  readonly description: string;
  /** Model capabilities */
  readonly capabilities: ModelCapabilities;
  /** Whether this model is recommended */
  readonly isRecommended?: boolean;
  /** Whether this model is featured */
  readonly isFeatured?: boolean;
  /** Maximum context length in tokens */
  readonly contextLength?: number;
  /** Maximum output tokens */
  readonly maxTokens?: number;
  /** Pricing information */
  readonly pricing?: ModelPricing;
}

/**
 * Model metadata ready for the UI (icon resolved to a component)
 */
export interface ModelInfo extends ModelDefinition {
  readonly icon: ElementType;
}

// ============================================================================
// CHAT TYPES
// ============================================================================

/**
 * Chat conversation data
 */
export interface Chat {
  /** Unique chat identifier */
  readonly id: string;
  /** Chat title */
  readonly title: string;
  /** Messages in the chat */
  readonly messages: readonly Message[];
  /** Creation timestamp (milliseconds since epoch) */
  readonly createdAt: number;
  /** Default model for the chat */
  readonly model: string;
  /** Custom prompt for chat behavior */
  readonly customizationPrompt?: string;
  /** Whether the chat is pinned */
  readonly isPinned?: boolean;
  /** Whether the chat is persisted to database */
  readonly isPersisted?: boolean;
}
