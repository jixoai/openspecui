import {
  clearCache,
  LocalModelAssetStateSchema,
  type LocalModelAssetState,
} from '@openspecui/core'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
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
    const tempPath = `${this.options.indexPath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, `${serialized}\n`, 'utf8')
    await rename(tempPath, this.options.indexPath)
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
