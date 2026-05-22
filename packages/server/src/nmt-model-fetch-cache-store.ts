import { clearCache } from '@openspecui/core'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'

const RawJsonRecordSchema = z.record(z.string(), z.unknown())
const HttpHeaderRecordSchema = z.record(z.string(), z.string())

const NmtModelFetchCacheQueryContextSchema = z.object({
  query: z.string().optional(),
  sourceLanguage: z.string().optional(),
  targetLanguage: z.string().optional(),
})

export const NmtModelProviderFetchRecordSchema = z.object({
  id: z.string().min(1),
  source: z.literal('huggingface'),
  fetchedAt: z.number().int().nonnegative(),
  request: z.object({
    method: z.literal('GET'),
    url: z.string().min(1),
    queryContext: NmtModelFetchCacheQueryContextSchema.optional(),
  }),
  response: z.object({
    status: z.number().int().nonnegative(),
    ok: z.boolean(),
    headers: HttpHeaderRecordSchema,
    bodyText: z.string(),
  }),
})

export const NmtModelFetchCacheRecordSchema = z.object({
  modelId: z.string().min(1),
  source: z.literal('huggingface'),
  listItemRaw: RawJsonRecordSchema.optional(),
  detailRaw: RawJsonRecordSchema.optional(),
  queryContext: NmtModelFetchCacheQueryContextSchema.optional(),
  listFetchedAt: z.number().int().nonnegative().optional(),
  detailFetchedAt: z.number().int().nonnegative().optional(),
  updatedAt: z.number().int().nonnegative(),
})

export const NmtModelFetchCacheFileSchema = z.object({
  version: z.literal(1).default(1),
  fetches: z.array(NmtModelProviderFetchRecordSchema).default([]),
  records: z.array(NmtModelFetchCacheRecordSchema).default([]),
})

export type NmtModelFetchCacheRecord = z.infer<typeof NmtModelFetchCacheRecordSchema>
export type NmtModelProviderFetchRecord = z.infer<typeof NmtModelProviderFetchRecordSchema>

export interface NmtModelFetchCacheStoreOptions {
  cachePath: string
  now?: () => number
}

export class NmtModelFetchCacheStore {
  private readonly now: () => number

  constructor(private readonly options: NmtModelFetchCacheStoreOptions) {
    this.now = options.now ?? Date.now
  }

  async readAll(): Promise<NmtModelFetchCacheRecord[]> {
    return (await this.readFile()).records
  }

  async readFetches(): Promise<NmtModelProviderFetchRecord[]> {
    return (await this.readFile()).fetches
  }

  private async readFile(): Promise<z.infer<typeof NmtModelFetchCacheFileSchema>> {
    try {
      const content = await readFile(this.options.cachePath, 'utf8')
      const parsed = JSON.parse(content) as unknown
      const result = NmtModelFetchCacheFileSchema.safeParse(parsed)
      return result.success ? result.data : NmtModelFetchCacheFileSchema.parse({})
    } catch {
      return NmtModelFetchCacheFileSchema.parse({})
    }
  }

  async read(modelId: string): Promise<NmtModelFetchCacheRecord | null> {
    return (await this.readMap()).get(modelId) ?? null
  }

  async readMap(): Promise<Map<string, NmtModelFetchCacheRecord>> {
    return new Map((await this.readAll()).map((record) => [record.modelId, record]))
  }

  async writeAll(records: ReadonlyArray<NmtModelFetchCacheRecord>): Promise<void> {
    const current = await this.readFile()
    await this.writeFile({
      fetches: current.fetches,
      records,
    })
  }

  private async writeFile(input: {
    fetches: ReadonlyArray<NmtModelProviderFetchRecord>
    records: ReadonlyArray<NmtModelFetchCacheRecord>
  }): Promise<void> {
    const normalized = NmtModelFetchCacheFileSchema.parse({
      version: 1,
      fetches: [...input.fetches].sort((left, right) => left.id.localeCompare(right.id)),
      records: [...input.records].sort((left, right) => left.modelId.localeCompare(right.modelId)),
    })
    await mkdir(dirname(this.options.cachePath), { recursive: true })
    await writeFile(this.options.cachePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
    clearCache()
  }

  async upsertProviderFetch(input: {
    url: string
    status: number
    ok: boolean
    headers: Record<string, string>
    bodyText: string
    queryContext?: NmtModelFetchCacheRecord['queryContext']
  }): Promise<void> {
    const current = await this.readFile()
    const id = buildProviderFetchId(input.url)
    const fetches = new Map(current.fetches.map((record) => [record.id, record]))
    fetches.set(
      id,
      NmtModelProviderFetchRecordSchema.parse({
        id,
        source: 'huggingface',
        fetchedAt: this.now(),
        request: {
          method: 'GET',
          url: input.url,
          queryContext: input.queryContext,
        },
        response: {
          status: input.status,
          ok: input.ok,
          headers: input.headers,
          bodyText: input.bodyText,
        },
      })
    )
    await this.writeFile({
      fetches: [...fetches.values()],
      records: current.records,
    })
  }

  async upsertListItem(input: {
    modelId: string
    raw: Record<string, unknown>
    queryContext?: NmtModelFetchCacheRecord['queryContext']
  }): Promise<void> {
    const records = await this.readMap()
    const current = records.get(input.modelId)
    records.set(
      input.modelId,
      NmtModelFetchCacheRecordSchema.parse({
        ...current,
        modelId: input.modelId,
        source: 'huggingface',
        listItemRaw: input.raw,
        queryContext: input.queryContext ?? current?.queryContext,
        listFetchedAt: this.now(),
        updatedAt: this.now(),
      })
    )
    await this.writeAll([...records.values()])
  }

  async upsertDetail(input: {
    modelId: string
    raw: Record<string, unknown>
    queryContext?: NmtModelFetchCacheRecord['queryContext']
  }): Promise<void> {
    const records = await this.readMap()
    const current = records.get(input.modelId)
    records.set(
      input.modelId,
      NmtModelFetchCacheRecordSchema.parse({
        ...current,
        modelId: input.modelId,
        source: 'huggingface',
        detailRaw: input.raw,
        queryContext: input.queryContext ?? current?.queryContext,
        detailFetchedAt: this.now(),
        updatedAt: this.now(),
      })
    )
    await this.writeAll([...records.values()])
  }
}

function buildProviderFetchId(url: string): string {
  return `huggingface:GET:${url}`
}
