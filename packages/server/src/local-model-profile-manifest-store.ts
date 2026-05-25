import {
  clearCache,
  LocalModelProfileManifestSchema,
  type LocalModelProfileManifest,
} from '@openspecui/core'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { z } from 'zod'

const LocalModelProfileManifestIndexSchema = z.object({
  version: z.literal(1).default(1),
  manifests: z.array(LocalModelProfileManifestSchema).default([]),
})

export interface LocalModelProfileManifestStoreOptions {
  manifestPath: string
}

export class LocalModelProfileManifestStore {
  constructor(private readonly options: LocalModelProfileManifestStoreOptions) {}

  getManifestPath(): string {
    return this.options.manifestPath
  }

  async readAll(): Promise<LocalModelProfileManifest[]> {
    return (await this.readFile()).manifests
  }

  async readMap(): Promise<Map<string, LocalModelProfileManifest>> {
    return new Map((await this.readAll()).map((manifest) => [manifest.modelId, manifest]))
  }

  async read(modelId: string): Promise<LocalModelProfileManifest | null> {
    return (await this.readMap()).get(modelId) ?? null
  }

  async writeAll(manifests: ReadonlyArray<LocalModelProfileManifest>): Promise<void> {
    const normalized = LocalModelProfileManifestIndexSchema.parse({
      version: 1,
      manifests: [...manifests].sort((left, right) => left.modelId.localeCompare(right.modelId)),
    })
    const serialized = JSON.stringify(normalized, null, 2)
    await mkdir(dirname(this.options.manifestPath), { recursive: true })
    const tempPath = `${this.options.manifestPath}.${process.pid}.${Date.now()}.tmp`
    await writeFile(tempPath, `${serialized}\n`, 'utf8')
    await rename(tempPath, this.options.manifestPath)
    clearCache()
  }

  async upsert(manifest: LocalModelProfileManifest): Promise<void> {
    const manifests = await this.readMap()
    manifests.set(manifest.modelId, LocalModelProfileManifestSchema.parse(manifest))
    await this.writeAll([...manifests.values()])
  }

  async remove(modelId: string): Promise<void> {
    const manifests = await this.readMap()
    if (!manifests.delete(modelId)) return
    await this.writeAll([...manifests.values()])
  }

  private async readFile(): Promise<z.infer<typeof LocalModelProfileManifestIndexSchema>> {
    try {
      const content = await readFile(this.options.manifestPath, 'utf8')
      const parsed = JSON.parse(content) as unknown
      const result = LocalModelProfileManifestIndexSchema.safeParse(parsed)
      return result.success ? result.data : LocalModelProfileManifestIndexSchema.parse({})
    } catch {
      return LocalModelProfileManifestIndexSchema.parse({})
    }
  }
}
