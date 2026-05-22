import {
  clearCache,
  NmtModelAssetStateSchema,
  type NmtModelAssetState,
} from '@openspecui/core'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const NmtModelAssetIndexSchema = NmtModelAssetStateSchema.array()

export interface NmtModelAssetStoreOptions {
  indexPath: string
}

export class NmtModelAssetStore {
  constructor(private readonly options: NmtModelAssetStoreOptions) {}

  getIndexPath(): string {
    return this.options.indexPath
  }

  async readAll(): Promise<NmtModelAssetState[]> {
    try {
      const content = await readFile(this.options.indexPath, 'utf8')
      const parsed = JSON.parse(content) as unknown
      const result = NmtModelAssetIndexSchema.safeParse(parsed)
      return result.success ? result.data : []
    } catch {
      return []
    }
  }

  async readMap(): Promise<Map<string, NmtModelAssetState>> {
    return new Map((await this.readAll()).map((state) => [state.modelId, state]))
  }

  async writeAll(states: ReadonlyArray<NmtModelAssetState>): Promise<void> {
    const normalized = NmtModelAssetIndexSchema.parse(
      [...states].sort((left, right) => left.modelId.localeCompare(right.modelId))
    )
    const serialized = JSON.stringify(normalized, null, 2)
    await mkdir(dirname(this.options.indexPath), { recursive: true })
    const tempPath = `${this.options.indexPath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, `${serialized}\n`, 'utf8')
    await rename(tempPath, this.options.indexPath)
    clearCache()
  }

  async upsert(state: NmtModelAssetState): Promise<void> {
    const states = await this.readMap()
    states.set(state.modelId, NmtModelAssetStateSchema.parse(state))
    await this.writeAll([...states.values()])
  }

  async remove(modelId: string): Promise<void> {
    const states = await this.readMap()
    if (!states.delete(modelId)) return
    await this.writeAll([...states.values()])
  }
}
