import { z } from 'zod'

/**
 * Message role in a conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant'

/**
 * A single message in a conversation
 */
export interface Message {
  role: MessageRole
  content: string
}

/**
 * Options for AI completion requests
 */
export interface CompletionOptions {
  messages: Message[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

/**
 * Response from an AI completion request
 */
export interface CompletionResponse {
  content: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * Streaming chunk from AI completion
 */
export interface StreamChunk {
  content: string
  done: boolean
}

/**
 * Base interface for AI providers
 * Both API and ACP providers implement this interface
 */
export interface AIProvider {
  readonly name: string
  readonly type: 'api' | 'acp'

  /**
   * Send a completion request
   */
  complete(options: CompletionOptions): Promise<CompletionResponse>

  /**
   * Send a streaming completion request
   */
  completeStream?(options: CompletionOptions): AsyncIterable<StreamChunk>

  /**
   * Check if the provider is available/connected
   */
  isAvailable(): Promise<boolean>

  /**
   * Clean up resources
   */
  dispose?(): Promise<void>
}

/**
 * Configuration for API-based providers (OpenAI compatible)
 */
export const APIProviderConfigSchema = z.object({
  type: z.literal('api'),
  name: z.string(),
  baseUrl: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string(),
  headers: z.record(z.string()).optional(),
})

export type APIProviderConfig = z.infer<typeof APIProviderConfigSchema>

/**
 * Configuration for ACP-based providers
 */
export const ACPProviderConfigSchema = z.object({
  type: z.literal('acp'),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
})

export type ACPProviderConfig = z.infer<typeof ACPProviderConfigSchema>

/**
 * Union of all provider configurations
 */
export const ProviderConfigSchema = z.discriminatedUnion('type', [
  APIProviderConfigSchema,
  ACPProviderConfigSchema,
])

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>

/**
 * Provider registry configuration
 */
export const ProviderRegistrySchema = z.object({
  defaultApi: z.string().optional(),
  defaultAcp: z.string().optional(),
  providers: z.record(ProviderConfigSchema),
})

export type ProviderRegistry = z.infer<typeof ProviderRegistrySchema>
