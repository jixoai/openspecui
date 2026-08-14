/**
 * Orthogonal intents (updated 2026-08-05 Asia/Shanghai):
 * 1. Persist normalized local-model lifecycle state through complete JSON replacements.
 * 2. Survive transient Windows target locks without exposing partial metadata.
 * 3. Retire reactive caches only after the replacement commits.
 *
 * Original request (2026-08-05): Continue the Windows adaptation and fix equivalent failures together.
 */
import {
  clearCache,
  LocalModelAssetStateSchema,
  replaceFileAtomically,
  type LocalModelAssetState,
} from '@openspecui/core'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const LocalModelAssetIndexSchema = LocalModelAssetStateSchema.array()

export interface LocalModelAssetStoreOptions {
  indexPath: string
}

export class LocalModelAssetStore {
  constructor(private readonly options: LocalModelAssetStoreOptions) {}

  getIndexPath(): string {
    return this.options.indexPath
  }

  async readAll(): Promise<LocalModelAssetState[]> {
    try {
      const content = await readFile(this.options.indexPath, 'utf8')
      const parsed = JSON.parse(content) as unknown
      const result = LocalModelAssetIndexSchema.safeParse(parsed)
      return result.success ? result.data : []
    } catch {
      return []
    }
  }

  async readMap(): Promise<Map<string, LocalModelAssetState>> {
    return new Map((await this.readAll()).map((state) => [state.modelId, state]))
  }

  async writeAll(states: ReadonlyArray<LocalModelAssetState>): Promise<void> {
    const normalized = LocalModelAssetIndexSchema.parse(
      [...states].sort((left, right) => left.modelId.localeCompare(right.modelId))
    )
    const serialized = JSON.stringify(normalized, null, 2)
    await mkdir(dirname(this.options.indexPath), { recursive: true })
    const tempPath = `${this.options.indexPath}.${process.pid}.${randomUUID()}.tmp`
    try {
      await writeFile(tempPath, `${serialized}\n`, 'utf8')
      await replaceFileAtomically(tempPath, this.options.indexPath)
    } finally {
      await rm(tempPath, { force: true }).catch(() => undefined)
    }
    clearCache()
  }

  async upsert(state: LocalModelAssetState): Promise<void> {
    const states = await this.readMap()
    states.set(state.modelId, LocalModelAssetStateSchema.parse(state))
    await this.writeAll([...states.values()])
  }

  async remove(modelId: string): Promise<void> {
    const states = await this.readMap()
    if (!states.delete(modelId)) return
    await this.writeAll([...states.values()])
  }
}
