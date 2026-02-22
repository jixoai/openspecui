import { ACPProvider } from './acp-provider.js'
import { APIProvider } from './api-provider.js'
import type { AIProvider, ProviderConfig, ProviderRegistry } from './types.js'

/**
 * Factory function to create a provider from configuration
 */
export function createProvider(config: ProviderConfig): AIProvider {
  switch (config.type) {
    case 'api':
      return new APIProvider(config)
    case 'acp':
      return new ACPProvider(config)
    default:
      throw new Error(`Unknown provider type: ${(config as { type: string }).type}`)
  }
}

/**
 * Provider manager for handling multiple AI providers
 */
export class ProviderManager {
  private providers = new Map<string, AIProvider>()
  private defaultApiName: string | null = null
  private defaultAcpName: string | null = null

  constructor(registry?: ProviderRegistry) {
    if (registry) {
      this.loadRegistry(registry)
    }
  }

  /**
   * Load providers from a registry configuration
   */
  loadRegistry(registry: ProviderRegistry): void {
    for (const [name, config] of Object.entries(registry.providers)) {
      const provider = createProvider(config)
      this.providers.set(name, provider)
    }

    if (registry.defaultApi) {
      this.defaultApiName = registry.defaultApi
    }
    if (registry.defaultAcp) {
      this.defaultAcpName = registry.defaultAcp
    }
  }

  /**
   * Register a provider
   */
  register(name: string, provider: AIProvider): void {
    this.providers.set(name, provider)
  }

  /**
   * Get a provider by name
   */
  get(name: string): AIProvider | undefined {
    return this.providers.get(name)
  }

  /**
   * Get the default API provider
   */
  getDefaultApi(): AIProvider | undefined {
    if (!this.defaultApiName) return undefined
    return this.providers.get(this.defaultApiName)
  }

  /**
   * Get the default ACP provider
   */
  getDefaultAcp(): AIProvider | undefined {
    if (!this.defaultAcpName) return undefined
    return this.providers.get(this.defaultAcpName)
  }

  /**
   * Set the default API provider
   */
  setDefaultApi(name: string): void {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new Error(`Provider '${name}' not found`)
    }
    if (provider.type !== 'api') {
      throw new Error(`Provider '${name}' is not an API provider`)
    }
    this.defaultApiName = name
  }

  /**
   * Set the default ACP provider
   */
  setDefaultAcp(name: string): void {
    const provider = this.providers.get(name)
    if (!provider) {
      throw new Error(`Provider '${name}' not found`)
    }
    if (provider.type !== 'acp') {
      throw new Error(`Provider '${name}' is not an ACP provider`)
    }
    this.defaultAcpName = name
  }

  /**
   * List all registered providers
   */
  list(): Array<{ name: string; type: 'api' | 'acp' }> {
    return Array.from(this.providers.entries()).map(([name, provider]) => ({
      name,
      type: provider.type,
    }))
  }

  /**
   * Check availability of all providers
   */
  async checkAvailability(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        const available = await provider.isAvailable()
        results.set(name, available)
      })
    )

    return results
  }

  /**
   * Dispose all providers
   */
  async dispose(): Promise<void> {
    await Promise.all(Array.from(this.providers.values()).map((provider) => provider.dispose?.()))
    this.providers.clear()
  }
}
