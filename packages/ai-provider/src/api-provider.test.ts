import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { APIProvider } from '../src/api-provider.js'
import type { APIProviderConfig } from '../src/types.js'

describe('APIProvider', () => {
  const mockConfig: APIProviderConfig = {
    type: 'api',
    name: 'test-api',
    baseUrl: 'https://api.example.com',
    apiKey: 'test-key',
    model: 'gpt-4',
  }

  let provider: APIProvider

  beforeEach(() => {
    provider = new APIProvider(mockConfig)
    vi.resetAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should set name and type correctly', () => {
      expect(provider.name).toBe('test-api')
      expect(provider.type).toBe('api')
    })
  })

  describe('complete', () => {
    it('should send a completion request and return response', async () => {
      const mockResponse = {
        choices: [{ message: { content: 'Hello, world!' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      )

      const result = await provider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(result.content).toBe('Hello, world!')
      expect(result.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://api.example.com/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          }),
        })
      )
    })

    it('should throw error on failed request', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: () => Promise.resolve('Unauthorized'),
        })
      )

      await expect(
        provider.complete({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toThrow('API request failed: 401 Unauthorized')
    })

    it('should handle missing api key', async () => {
      const noKeyProvider = new APIProvider({
        ...mockConfig,
        apiKey: undefined,
      })

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              choices: [{ message: { content: 'Response' } }],
            }),
        })
      )

      await noKeyProvider.complete({
        messages: [{ role: 'user', content: 'Hello' }],
      })

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.any(String),
          }),
        })
      )
    })
  })

  describe('isAvailable', () => {
    it('should return true when API responds OK', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))

      const result = await provider.isAvailable()
      expect(result).toBe(true)
    })

    it('should return false when API fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

      const result = await provider.isAvailable()
      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const result = await provider.isAvailable()
      expect(result).toBe(false)
    })
  })
})
