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
  MessageRole,
  Message,
  CompletionOptions,
  CompletionResponse,
  StreamChunk,
  AIProvider,
  APIProviderConfig,
  ACPProviderConfig,
  ProviderConfig,
  ProviderRegistry,
} from './types.js'

export {
  APIProviderConfigSchema,
  ACPProviderConfigSchema,
  ProviderConfigSchema,
  ProviderRegistrySchema,
} from './types.js'

// Providers
export { APIProvider } from './api-provider.js'
export { ACPProvider, ACPAgents } from './acp-provider.js'

// Manager
export { createProvider, ProviderManager } from './manager.js'
