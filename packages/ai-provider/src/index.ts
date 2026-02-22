/**
 * @openspecui/ai-provider
 *
 * AI provider abstraction layer supporting both API-based providers
 * (OpenAI compatible) and ACP-based providers (Agent Client Protocol).
 *
 * Features:
 * - Unified interface for different AI backends
 * - Support for streaming completions
 * - Provider registry for managing multiple providers
 * - Predefined ACP agent configurations
 *
 * @packageDocumentation
 */

// Types
export type {
  ACPProviderConfig,
  AIProvider,
  APIProviderConfig,
  CompletionOptions,
  CompletionResponse,
  Message,
  MessageRole,
  ProviderConfig,
  ProviderRegistry,
  StreamChunk,
} from './types.js'

export {
  ACPProviderConfigSchema,
  APIProviderConfigSchema,
  ProviderConfigSchema,
  ProviderRegistrySchema,
} from './types.js'

// Providers
export { ACPAgents, ACPProvider } from './acp-provider.js'
export { APIProvider } from './api-provider.js'

// Manager
export { ProviderManager, createProvider } from './manager.js'
