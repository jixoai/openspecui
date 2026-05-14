import {
  CustomSoundHashSchema,
  CustomSoundMetadataFileSchema,
  customHashFromSoundId,
  soundIdFromCustomHash,
  type CustomSoundHash,
  type CustomSoundMetadata,
  type CustomSoundMetadataFile,
  type SoundId,
} from '@openspecui/core/sounds'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const METADATA_FILE = 'metadatas.json'

function getDefaultSoundsDir(): string {
  return join(homedir(), '.openspecui', 'sounds')
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}

function getFallbackName(filename: string | undefined, hash: string): string {
  const trimmed = filename?.trim()
  return trimmed ? trimmed.replace(/\.[^.]*$/, '') : hash.slice(0, 12)
}

export interface CustomSoundUploadInput {
  bytes: Uint8Array
  name?: string
  mime: string
}

export interface CustomSoundFile {
  metadata: CustomSoundMetadata
  data: ArrayBuffer
}

export class CustomSoundService {
  private readonly soundsDir: string
  private readonly metadataPath: string

  constructor(soundsDir = getDefaultSoundsDir()) {
    this.soundsDir = soundsDir
    this.metadataPath = join(soundsDir, METADATA_FILE)
  }

  async listAvailable(): Promise<CustomSoundMetadata[]> {
    const metadatas = await this.readMetadatas()
    const available: CustomSoundMetadata[] = []
    for (const metadata of Object.values(metadatas)) {
      if (await this.hasSoundFile(metadata.id)) {
        available.push(metadata)
      }
    }
    return available.sort((left, right) => right.updatedAt - left.updatedAt)
  }

  async upload(input: CustomSoundUploadInput): Promise<CustomSoundMetadata> {
    if (!input.mime.startsWith('audio/')) {
      throw new Error('Only audio files are supported.')
    }

    const hash = hashSoundBytes(input.bytes)
    const now = Date.now()
    const metadatas = await this.readMetadatas()
    const previous = metadatas[hash]
    const metadata: CustomSoundMetadata = {
      id: hash,
      name: previous?.name ?? getFallbackName(input.name, hash),
      mime: input.mime,
      size: input.bytes.byteLength,
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
    }

    await mkdir(this.soundsDir, { recursive: true })
    await writeFile(this.getSoundPath(hash), input.bytes)
    await this.writeMetadatas({ ...metadatas, [hash]: metadata })
    return metadata
  }

  async rename(id: SoundId, name: string): Promise<CustomSoundMetadata> {
    const hash = this.requireCustomHash(id)
    const nextName = name.trim()
    if (!nextName) {
      throw new Error('Sound name is required.')
    }

    const metadatas = await this.readMetadatas()
    const current = metadatas[hash]
    if (!current || !(await this.hasSoundFile(hash))) {
      throw new Error('Sound not found.')
    }

    const next = { ...current, name: nextName, updatedAt: Date.now() }
    await this.writeMetadatas({ ...metadatas, [hash]: next })
    return next
  }

  async remove(id: SoundId): Promise<void> {
    const hash = this.requireCustomHash(id)
    const metadatas = await this.readMetadatas()
    const next = { ...metadatas }
    delete next[hash]
    await rm(this.getSoundPath(hash), { force: true })
    await this.writeMetadatas(next)
  }

  async getFile(id: SoundId): Promise<CustomSoundFile | null> {
    const hash = customHashFromSoundId(id)
    if (!hash) return null

    const metadatas = await this.readMetadatas()
    const metadata = metadatas[hash]
    if (!metadata || !(await this.hasSoundFile(hash))) {
      return null
    }

    return {
      metadata,
      data: await readSoundData(this.getSoundPath(hash)),
    }
  }

  buildSoundId(hash: CustomSoundHash): SoundId {
    return soundIdFromCustomHash(hash)
  }

  private requireCustomHash(id: SoundId): CustomSoundHash {
    const hash = customHashFromSoundId(id)
    if (!hash) {
      throw new Error('Custom sound id is required.')
    }
    return hash
  }

  private getSoundPath(hash: CustomSoundHash): string {
    return join(this.soundsDir, hash)
  }

  private async hasSoundFile(hash: CustomSoundHash): Promise<boolean> {
    try {
      const fileStat = await stat(this.getSoundPath(hash))
      return fileStat.isFile()
    } catch (error) {
      if (isNotFound(error)) return false
      throw error
    }
  }

  private async readMetadatas(): Promise<CustomSoundMetadataFile> {
    try {
      const content = await readFile(this.metadataPath, 'utf-8')
      const parsed = JSON.parse(content)
      const result = CustomSoundMetadataFileSchema.safeParse(parsed)
      return result.success ? result.data : {}
    } catch (error) {
      if (isNotFound(error)) return {}
      if (error instanceof SyntaxError) return {}
      throw error
    }
  }

  private async writeMetadatas(metadatas: CustomSoundMetadataFile): Promise<void> {
    await mkdir(this.soundsDir, { recursive: true })
    await writeFile(this.metadataPath, JSON.stringify(metadatas, null, 2), 'utf-8')
  }
}

export function hashSoundBytes(bytes: Uint8Array): CustomSoundHash {
  return CustomSoundHashSchema.parse(createHash('sha256').update(bytes).digest('hex'))
}

async function readSoundData(path: string): Promise<ArrayBuffer> {
  const bytes = await readFile(path)
  const data = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(data).set(bytes)
  return data
}
