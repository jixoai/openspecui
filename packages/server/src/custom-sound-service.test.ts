import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CustomSoundService, hashSoundBytes } from './custom-sound-service.js'

const tempDirs: string[] = []

async function createSoundsDir(): Promise<string> {
  const dir = join(tmpdir(), `openspecui-sounds-${crypto.randomUUID()}`)
  await mkdir(dir, { recursive: true })
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop()
    if (dir) {
      await rm(dir, { recursive: true, force: true })
    }
  }
})

describe('CustomSoundService', () => {
  it('stores uploaded audio by sha256 hash without a file extension', async () => {
    const soundsDir = await createSoundsDir()
    const service = new CustomSoundService(soundsDir)
    const bytes = new TextEncoder().encode('audio-bytes')
    const hash = hashSoundBytes(bytes)

    const metadata = await service.upload({
      bytes,
      name: 'Ping.mp3',
      mime: 'audio/mp3',
    })

    expect(metadata).toMatchObject({
      id: hash,
      name: 'Ping',
      mime: 'audio/mp3',
      size: bytes.byteLength,
    })
    await expect(readFile(join(soundsDir, hash), 'utf-8')).resolves.toBe('audio-bytes')
    await expect(readFile(join(soundsDir, 'metadatas.json'), 'utf-8')).resolves.toContain(
      `"${hash}"`
    )
  })

  it('lists only metadata entries that still have files', async () => {
    const soundsDir = await createSoundsDir()
    const service = new CustomSoundService(soundsDir)
    const metadata = await service.upload({
      bytes: new TextEncoder().encode('present'),
      name: 'Present',
      mime: 'audio/wav',
    })
    await service.upload({
      bytes: new TextEncoder().encode('missing'),
      name: 'Missing',
      mime: 'audio/wav',
    })
    await rm(join(soundsDir, hashSoundBytes(new TextEncoder().encode('missing'))), { force: true })

    await expect(service.listAvailable()).resolves.toEqual([metadata])
  })

  it('renames and deletes custom sounds with metadata', async () => {
    const soundsDir = await createSoundsDir()
    const service = new CustomSoundService(soundsDir)
    const metadata = await service.upload({
      bytes: new TextEncoder().encode('audio'),
      name: 'Before',
      mime: 'audio/aiff',
    })
    const soundId = service.buildSoundId(metadata.id)

    await expect(service.rename(soundId, 'After')).resolves.toMatchObject({ name: 'After' })
    await service.remove(soundId)

    await expect(service.listAvailable()).resolves.toEqual([])
  })
})
