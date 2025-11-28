import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProviderManager, createProvider } from '../src/manager.js'
import type { ProviderRegistry, APIProviderConfig, ACPProviderConfig } from '../src/types.js'

describe('createProvider', () => {
  it('should create APIProvider for api type', () => {
    const config: APIProviderConfig = {
      type: 'api',
      name: 'test',
      baseUrl: 'https://api.example.com',
      model: 'gpt-4',
    }

    const provider = createProvider(config)
    expect(provider.type).toBe('api')
    expect(provider.name).toBe('test')
  })

  it('should create ACPProvider for acp type', () => {
    const config: ACPProviderConfig = {
      type: 'acp',
      name: 'test-acp',
      command: 'test-cmd',
      args: [],
    }

    const provider = createProvider(config)
    expect(provider.type).toBe('acp')
    expect(provider.name).toBe('test-acp')
  })
})

describe('ProviderManager', () => {
  let manager: ProviderManager

  beforeEach(() => {
    manager = new ProviderManager()
  })

  describe('register and get', () => {
    it('should register and retrieve a provider', () => {
      const provider = createProvider({
        type: 'api',
        name: 'test',
        baseUrl: 'https://api.example.com',
        model: 'gpt-4',
      })

      manager.register('my-provider', provider)

      const retrieved = manager.get('my-provider')
      expect(retrieved).toBe(provider)
    })

    it('should return undefined for unknown provider', () => {
      expect(manager.get('unknown')).toBeUndefined()
    })
  })

  describe('loadRegistry', () => {
    it('should load providers from registry', () => {
      const registry: ProviderRegistry = {
        defaultApi: 'openai',
        defaultAcp: 'iflow',
        providers: {
          openai: {
            type: 'api',
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            model: 'gpt-4',
          },
          iflow: {
            type: 'acp',
            name: 'iFlow',
            command: 'iflow',
            args: ['--acp'],
          },
        },
      }

      manager.loadRegistry(registry)

      expect(manager.get('openai')).toBeDefined()
      expect(manager.get('iflow')).toBeDefined()
      expect(manager.getDefaultApi()?.name).toBe('OpenAI')
      expect(manager.getDefaultAcp()?.name).toBe('iFlow')
    })
  })

  describe('list', () => {
    it('should list all registered providers', () => {
      manager.register(
        'api1',
        createProvider({
          type: 'api',
          name: 'API 1',
          baseUrl: 'https://api1.example.com',
          model: 'model1',
        })
      )
      manager.register(
        'acp1',
        createProvider({
          type: 'acp',
          name: 'ACP 1',
          command: 'cmd1',
          args: [],
        })
      )

      const list = manager.list()

      expect(list).toHaveLength(2)
      expect(list).toContainEqual({ name: 'api1', type: 'api' })
      expect(list).toContainEqual({ name: 'acp1', type: 'acp' })
    })
  })

  describe('setDefault', () => {
    beforeEach(() => {
      manager.register(
        'api1',
        createProvider({
          type: 'api',
          name: 'API 1',
          baseUrl: 'https://api.example.com',
          model: 'model',
        })
      )
      manager.register(
        'acp1',
        createProvider({
          type: 'acp',
          name: 'ACP 1',
          command: 'cmd',
          args: [],
        })
      )
    })

    it('should set default API provider', () => {
      manager.setDefaultApi('api1')
      expect(manager.getDefaultApi()?.name).toBe('API 1')
    })

    it('should set default ACP provider', () => {
      manager.setDefaultAcp('acp1')
      expect(manager.getDefaultAcp()?.name).toBe('ACP 1')
    })

    it('should throw error for unknown provider', () => {
      expect(() => manager.setDefaultApi('unknown')).toThrow("Provider 'unknown' not found")
    })

    it('should throw error for wrong provider type', () => {
      expect(() => manager.setDefaultApi('acp1')).toThrow("Provider 'acp1' is not an API provider")
      expect(() => manager.setDefaultAcp('api1')).toThrow("Provider 'api1' is not an ACP provider")
    })
  })

  describe('checkAvailability', () => {
    it('should check availability of all providers', async () => {
      // Mock fetch for API provider
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true })
      )

      manager.register(
        'api1',
        createProvider({
          type: 'api',
          name: 'API 1',
          baseUrl: 'https://api.example.com',
          model: 'model',
        })
      )

      const results = await manager.checkAvailability()

      expect(results.get('api1')).toBe(true)
    })
  })
})
