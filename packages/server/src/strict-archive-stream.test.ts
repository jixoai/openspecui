/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove successful validation hands one terminal stream to archive.
 * 2. Prove validation failure never starts archive.
 * 3. Prove cancellation and archive-start failure settle asynchronous phase races.
 *
 * Original request (2026-07-15): "Archive readiness remains a CLI validate/archive outcome."
 */
import type { CliStreamEvent } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { startStrictArchiveStream } from './strict-archive-stream.js'

describe('startStrictArchiveStream', () => {
  it('suppresses the successful validation exit and emits the archive terminal exit', async () => {
    const events: CliStreamEvent[] = []
    const validateCancel = vi.fn()
    const archiveCancel = vi.fn()
    const startArchive = vi.fn((onEvent: (event: CliStreamEvent) => void) => {
      onEvent({ type: 'command', data: 'openspec archive -y demo --no-validate' })
      onEvent({ type: 'exit', exitCode: 0 })
      return archiveCancel
    })

    const cancel = await startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'command', data: 'openspec validate demo --strict' })
        onEvent({ type: 'exit', exitCode: 0 })
        return validateCancel
      },
      startArchive,
      onEvent: (event) => events.push(event),
    })
    await vi.waitFor(() => expect(startArchive).toHaveBeenCalledOnce())

    expect(events.filter((event) => event.type === 'exit')).toEqual([{ type: 'exit', exitCode: 0 }])
    expect(validateCancel).toHaveBeenCalledOnce()
    cancel()
    expect(archiveCancel).toHaveBeenCalledOnce()
  })

  it('preserves validation failure and does not start archive', async () => {
    const events: CliStreamEvent[] = []
    const startArchive = vi.fn(() => vi.fn())

    await startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'stderr', data: 'strict validation failed' })
        onEvent({ type: 'exit', exitCode: 1 })
        return vi.fn()
      },
      startArchive,
      onEvent: (event) => events.push(event),
    })

    expect(startArchive).not.toHaveBeenCalled()
    expect(events.at(-1)).toEqual({ type: 'exit', exitCode: 1 })
  })

  it('cancels archive startup that resolves after client detachment', async () => {
    const archiveStart = Promise.withResolvers<() => void>()
    const archiveCancel = vi.fn()
    const cancel = await startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return vi.fn()
      },
      startArchive: () => archiveStart.promise,
      onEvent: vi.fn(),
    })

    cancel()
    archiveStart.resolve(archiveCancel)

    await vi.waitFor(() => expect(archiveCancel).toHaveBeenCalledOnce())
  })

  it('turns archive startup rejection into terminal indeterminate evidence', async () => {
    const events: CliStreamEvent[] = []
    await startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return vi.fn()
      },
      startArchive: async () => {
        throw new Error('archive process failed to start')
      },
      onEvent: (event) => events.push(event),
    })

    await vi.waitFor(() => {
      expect(events).toEqual([
        { type: 'stderr', data: 'archive process failed to start' },
        { type: 'exit', exitCode: null },
      ])
    })
  })
})
