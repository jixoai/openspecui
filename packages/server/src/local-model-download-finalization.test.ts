/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove local-model finalization waits for a transient Windows target lock and commits one complete file.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { mkdtemp, open, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'
import { finalizeDownloadedFile } from './local-model-asset-service.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true, maxRetries: 20 }))
  )
})

describe.runIf(process.platform === 'win32')('Windows local-model download finalization', () => {
  it('settles after the existing target handle is released', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-model-finalize-'))
    tempDirs.push(root)
    const targetPath = join(root, 'model.bin')
    const incompletePath = `${targetPath}.incomplete`
    await writeFile(targetPath, 'previous')
    await writeFile(incompletePath, 'complete')
    const handle = await open(targetPath, 'r')
    let settled = false
    const finalization = finalizeDownloadedFile({ incompletePath, targetPath }).finally(() => {
      settled = true
    })

    await delay(75)
    expect(settled).toBe(false)
    await handle.close()
    await finalization

    await expect(readFile(targetPath, 'utf8')).resolves.toBe('complete')
    await expect(readFile(incompletePath, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
