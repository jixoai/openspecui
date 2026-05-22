import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LocalModelFetchCacheStore } from './local-model-fetch-cache-store'
import {
  getLocalModelDownloadPlan,
  searchLocalModels,
  searchLocalModelsProgressively,
} from './translation-model-catalog'

const originalFetch = globalThis.fetch

describe('translation-model-catalog', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('retries Hugging Face search once after a timeout-like fetch failure', async () => {
    const timeoutError = new TypeError('fetch failed', {
      cause: new Error('Connect Timeout Error'),
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'Xenova/opus-mt-no-de',
              pipeline_tag: 'translation',
              tags: ['transformers.js', 'onnx', 'translation', 'no', 'de'],
              downloads: 502,
              likes: 12,
              trendingScore: 4,
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'Xenova/opus-mt-no-de',
            pipeline_tag: 'translation',
            tags: ['transformers.js', 'onnx', 'translation', 'no', 'de'],
            downloads: 502,
            likes: 12,
            trendingScore: 4,
            config: { is_encoder_decoder: true },
            siblings: [
              { rfilename: 'onnx/encoder_model_quantized.onnx', size: 24600000 },
              { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 28906014 },
            ],
          })
        )
      )
    globalThis.fetch = fetchMock

    const result = await searchLocalModels({ targetLanguage: 'de', limit: 1 })

    expect(result.items[0]?.id).toBe('Xenova/opus-mt-no-de')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('resolves the smallest verified model download plan', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'Xenova/opus-mt-no-de',
          pipeline_tag: 'translation',
          tags: ['transformers.js', 'onnx', 'translation', 'no', 'de'],
          downloads: 502,
          likes: 12,
          trendingScore: 4,
          config: { is_encoder_decoder: true },
          siblings: [
            { rfilename: 'onnx/encoder_model_quantized.onnx', size: 24600000 },
            { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 28906014 },
          ],
        })
      )
    )
    globalThis.fetch = fetchMock

    const plan = await getLocalModelDownloadPlan('Xenova/opus-mt-no-de')

    expect(plan).toMatchObject({
      modelId: 'Xenova/opus-mt-no-de',
      estimatedTotalBytes: 53506014,
    })
    expect(plan?.files).toHaveLength(2)
  })

  it('stores Hugging Face responses as raw request-level fetch-cache truth', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-nmt-fetch-cache-'))
    try {
      const fetchCacheStore = new LocalModelFetchCacheStore({
        cachePath: join(tempDir, 'fetch-cache.json'),
        now: () => 123,
      })
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              {
                id: 'Xenova/opus-mt-en-de',
                pipeline_tag: 'translation',
                tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
                downloads: 502,
                likes: 12,
                trendingScore: 4,
              },
            ]),
            {
              status: 200,
              headers: {
                'x-test-list': 'yes',
              },
            }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'Xenova/opus-mt-en-de',
              pipeline_tag: 'translation',
              tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
              downloads: 502,
              likes: 12,
              trendingScore: 4,
              config: { is_encoder_decoder: true },
              siblings: [
                { rfilename: 'onnx/encoder_model_quantized.onnx', size: 35_000_000 },
                { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 56_000_000 },
              ],
            }),
            {
              status: 200,
              headers: {
                'x-test-detail': 'yes',
              },
            }
          )
        )
      globalThis.fetch = fetchMock

      await searchLocalModels({ targetLanguage: 'de', query: 'opus', limit: 1 }, { fetchCacheStore })

      const fetches = await fetchCacheStore.readFetches()
      expect(fetches).toHaveLength(2)
      expect(fetches[0]).toMatchObject({
        source: 'huggingface',
        fetchedAt: 123,
        request: {
          method: 'GET',
          queryContext: { query: 'opus', targetLanguage: 'de' },
        },
        response: {
          status: 200,
          ok: true,
        },
      })
      expect(fetches.map((record) => record.request.url)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('/api/models?'),
          expect.stringContaining('/api/models/Xenova/opus-mt-en-de?blobs=true'),
        ])
      )
      expect(fetches.map((record) => record.response.bodyText).join('\n')).toContain(
        'onnx/encoder_model_quantized.onnx'
      )
      expect((await fetchCacheStore.read('Xenova/opus-mt-en-de'))?.detailRaw).toMatchObject({
        id: 'Xenova/opus-mt-en-de',
      })
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('uses configured Hugging Face-compatible endpoint for catalog fetches', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'Xenova/opus-mt-en-de',
              pipeline_tag: 'translation',
              tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
              downloads: 502,
              likes: 12,
              trendingScore: 4,
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'Xenova/opus-mt-en-de',
            pipeline_tag: 'translation',
            tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
            downloads: 502,
            likes: 12,
            trendingScore: 4,
            config: { is_encoder_decoder: true },
            siblings: [
              { rfilename: 'onnx/encoder_model_quantized.onnx', size: 35_000_000 },
              { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 56_000_000 },
            ],
          })
        )
      )
    globalThis.fetch = fetchMock

    await searchLocalModels(
      { targetLanguage: 'de', limit: 1 },
      { hfEndpoint: 'https://hf-mirror.com/' }
    )

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^https:\/\/hf-mirror\.com\/api\/models\?/),
      expect.any(Object)
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://hf-mirror.com/api/models/Xenova/opus-mt-en-de?blobs=true',
      expect.any(Object)
    )
  })

  it('exposes strict profile chips and selects the smallest concrete group', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'Xenova/opus-mt-en-de',
          pipeline_tag: 'translation',
          tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
          downloads: 502,
          likes: 12,
          trendingScore: 4,
          config: { is_encoder_decoder: true },
          siblings: [
            { rfilename: 'onnx/encoder_model_quantized.onnx', size: 35_000_000 },
            { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 56_000_000 },
            { rfilename: 'onnx/encoder_model_q4.onnx', size: 18_000_000 },
            { rfilename: 'onnx/decoder_model_merged_q4.onnx', size: 28_000_000 },
            { rfilename: 'onnx/encoder_model_fp16.onnx', size: 90_000_000 },
            { rfilename: 'onnx/decoder_model_merged_fp16.onnx', size: 140_000_000 },
          ],
        })
      )
    )
    globalThis.fetch = fetchMock

    const plan = await getLocalModelDownloadPlan('Xenova/opus-mt-en-de')

    expect(plan?.selectedGroupId).toBe('q4')
    expect(plan?.estimatedTotalBytes).toBe(46_000_000)
    expect(plan?.groups?.map((group) => group.id)).toEqual(
      expect.arrayContaining(['q4', 'q8', 'fp16'])
    )
    expect(plan?.groups?.find((group) => group.id === 'q8')).toMatchObject({
      estimatedTotalBytes: 91_000_000,
      selectable: true,
    })
  })

  it('keeps unknown-size profile groups disabled', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'Xenova/opus-mt-en-de',
          pipeline_tag: 'translation',
          tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
          downloads: 502,
          likes: 12,
          trendingScore: 4,
          config: { is_encoder_decoder: true },
          siblings: [
            { rfilename: 'onnx/encoder_model_quantized.onnx' },
            { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 56_000_000 },
          ],
        })
      )
    )
    globalThis.fetch = fetchMock

    const plan = await getLocalModelDownloadPlan('Xenova/opus-mt-en-de')

    expect(plan?.estimatedTotalBytes).toBeUndefined()
    expect(plan?.files).toEqual([])
    expect(plan?.groups).toEqual([
      expect.objectContaining({
        id: 'q8',
        selectable: false,
        estimatedTotalBytes: 56_000_000,
      }),
    ])
  })

  it('emits progressive remote search events from candidates to enriched completion', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              id: 'Xenova/opus-mt-en-de',
              pipeline_tag: 'translation',
              tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
              downloads: 502,
              likes: 12,
              trendingScore: 4,
            },
          ])
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'Xenova/opus-mt-en-de',
            pipeline_tag: 'translation',
            tags: ['transformers.js', 'onnx', 'translation', 'en', 'de'],
            downloads: 502,
            likes: 12,
            trendingScore: 4,
            config: { is_encoder_decoder: true },
            siblings: [
              { rfilename: 'onnx/encoder_model_quantized.onnx', size: 35_000_000 },
              { rfilename: 'onnx/decoder_model_merged_quantized.onnx', size: 56_000_000 },
            ],
          })
        )
      )
    globalThis.fetch = fetchMock

    const events = await searchLocalModelsProgressively({
      requestId: 'request-1',
      targetLanguage: 'de',
      limit: 1,
    })

    expect(events.map((event) => event.phase)).toEqual(['candidates', 'enriched', 'complete'])
    expect(events[0]?.items?.[0]?.downloadGroups).toBeUndefined()
    expect(events[1]?.items?.[0]?.downloadGroups?.[0]).toMatchObject({
      id: 'q8',
      selectable: true,
      estimatedTotalBytes: 91_000_000,
    })
  })
})
