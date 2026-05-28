import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchLlamaModels, searchLlamaModelsProgressively } from './llama-model-catalog.js'

const originalFetch = globalThis.fetch

describe('llama-model-catalog', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('returns a recommended gguf model when the search query is blank', async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
          pipeline_tag: 'text-generation',
          tags: ['gguf', 'translation'],
          downloads: 42,
          likes: 7,
          siblings: [{ rfilename: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf', size: 397_942_432 }],
        }),
        { status: 200 }
      )
    )

    const result = await searchLlamaModels({ query: '', limit: 6 })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
      compatibility: { localRuntimeVerified: true },
      size: { estimatedTotalBytes: 397_942_432 },
    })
  })

  it('keeps the blank-query recommendation path in progressive search events', async () => {
    globalThis.fetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'bartowski/Qwen2.5-0.5B-Instruct-GGUF',
          pipeline_tag: 'text-generation',
          tags: ['gguf', 'translation'],
          downloads: 42,
          likes: 7,
          siblings: [{ rfilename: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf', size: 397_942_432 }],
        }),
        { status: 200 }
      )
    )

    const events = await searchLlamaModelsProgressively({
      requestId: 'blank-query',
      query: '',
      limit: 6,
    })

    expect(events.map((event) => event.phase)).toEqual(['candidates', 'enriched', 'complete'])
    expect(events[0]?.items?.[0]?.id).toBe('bartowski/Qwen2.5-0.5B-Instruct-GGUF')
  })
})
