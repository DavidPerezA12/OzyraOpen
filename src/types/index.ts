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
 * import { Message, Chat, ModelInfo, UserPreferences } from '../types';
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

export type ChatGenerationState = {
  partialResponse: string | null;
  thinkingProcessContent: string | null;
  isReasoning: boolean;
  streamingComplete: boolean;
};

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
 * Source information for grounded segments in AI responses
 */
interface SourceInfo {
  /** URL of the source */
  readonly url: string;
  /** Title of the source page */
  readonly title: string;
  /** Confidence score of the source relevance (0-100) */
  readonly confidence: number;
}

/**
 * Grounded segment with supporting sources
 */
export interface GroundedSegment {
  /** The text segment grounded in sources */
  readonly text: string;
  /** List of sources supporting this text segment */
  readonly sources: readonly SourceInfo[];
}

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
  /** Indicates whether the message generation finished successfully */
  readonly isComplete?: boolean;
  /** Flag indicating if the message is currently being edited */
  readonly isEditing?: boolean;
  /** Optional "thinking" process content before generating the final response */
  readonly thinkingContent?: string;
  /** Flag indicating if web search was used */
  readonly useWebSearch?: boolean;
  /** List of search queries used if web search was enabled */
  readonly searchQueries?: readonly string[];
  /** Segments of the response grounded in web search results */
  readonly groundedSegments?: readonly GroundedSegment[];
  /** Annotations within the message content */
  readonly annotations?: readonly MessageAnnotation[];
  /** Files or images attached to the message */
  readonly attachments?: readonly MessageAttachment[];
  /** Local persistence state */
  readonly syncStatus?: 'local-only' | 'pending-sync' | 'synced' | 'sync-error';
  /** Last local update timestamp */
  readonly updatedAt?: number;
}

// ============================================================================
// MODEL TYPES
// ============================================================================

/** Available model tiers */
export type ModelTier = 'standard' | 'premium';

/** Supported model providers */
export type ModelProvider = 'openrouter';

/**
 * Model capabilities configuration
 */
export interface ModelCapabilities {
  /** Optimized for low latency */
  readonly fast: boolean;
  /** Computer vision / image understanding */
  readonly vision: boolean;
  /** Advanced reasoning capabilities */
  readonly reasoning: boolean;
  /** Supports effort-level control for reasoning */
  readonly effortControl: boolean;
  /** Tool calling integrations */
  readonly toolCalling: boolean;
  /** Image generation capabilities */
  readonly imageGeneration: boolean;
  /** Advanced PDF/document comprehension */
  readonly pdfComprehension: boolean;
  /** Extended thinking phase support */
  readonly thinking: boolean;
  /** Legacy alias: vision */
  readonly images: boolean;
  /** Legacy alias: pdfComprehension */
  readonly files: boolean;
  /** Legacy alias retained for compatibility */
  readonly webSearch: boolean;
  /** Legacy alias: toolCalling */
  readonly tools: boolean;
  /** Legacy alias: effortControl */
  readonly reasoningLevels: boolean;
}

/**
{{ ... }}
 * Model pricing information
 */
export interface ModelPricing {
  /** Cost per input token */
  readonly input: number;
  /** Cost per output token */
  readonly output: number;
}

/**
 * Complete model information and metadata
 */
export interface ModelInfo {
  /** Unique model identifier */
  readonly id: string;
  /** Display name of the model */
  readonly name: string;
  /** Icono del modelo: componente React o ruta SVG */
  readonly icon: ElementType | string;
  /** Provider identifier */
  readonly provider: ModelProvider;
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
  /** Whether this model is marked as special */
  readonly isSpecial?: boolean;
  /** Whether this model is newly added */
  readonly isNew?: boolean;
  /** Whether this model is featured */
  readonly isFeatured?: boolean;
  /** Maximum context length in tokens */
  readonly contextLength?: number;
  /** Maximum output tokens */
  readonly maxTokens?: number;
  /** Pricing information */
  readonly pricing?: ModelPricing;
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
  /** Local persistence state */
  readonly syncStatus?: 'local-only' | 'pending-sync' | 'synced' | 'sync-error';
  /** Last successful sync/update timestamp */
  readonly lastSyncedAt?: number;
  /** Last local update timestamp */
  readonly updatedAt?: number;
  /** Whether the chat has been locally deleted pending cleanup */
  readonly isDeleted?: boolean;
}
