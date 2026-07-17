/**
 * Orthogonal intents (updated 2026-07-17 Asia/Shanghai):
 * 1. Prove successful validation hands one terminal stream to archive.
 * 2. Prove validation failure never starts archive.
 * 3. Prove cancellation and archive-start failure settle phase ownership exactly once.
 *
 * Original request (2026-07-15): "Archive readiness remains a CLI validate/archive outcome."
 * Original request (2026-07-17): "Strict Archive owns one lease through validation and Archive settlement."
 */
import type { CliStreamEvent, CliStreamHandle, CliStreamSettlement } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { startStrictArchiveStream } from './strict-archive-stream.js'

function settledHandle(exitCode: number | null): CliStreamHandle {
  const settlement: CliStreamSettlement = { reason: 'exited', exitCode }
  return {
    settled: Promise.resolve(settlement),
    cancel: () => Promise.resolve(settlement),
  }
}

function controlledHandle(): {
  handle: CliStreamHandle
  cancel: ReturnType<typeof vi.fn>
} {
  const terminal = Promise.withResolvers<CliStreamSettlement>()
  const cancel = vi.fn(() => {
    terminal.resolve({ reason: 'cancelled', exitCode: null })
    return terminal.promise
  })
  return { handle: { settled: terminal.promise, cancel }, cancel }
}

describe('startStrictArchiveStream', () => {
  it('suppresses the successful validation exit and emits the archive terminal exit', async () => {
    const events: CliStreamEvent[] = []
    const startArchive = vi.fn((onEvent: (event: CliStreamEvent) => void) => {
      onEvent({ type: 'command', data: 'openspec archive -y demo --no-validate' })
      onEvent({ type: 'exit', exitCode: 0 })
      return settledHandle(0)
    })

    const stream = startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'command', data: 'openspec validate demo --strict' })
        onEvent({ type: 'exit', exitCode: 0 })
        return settledHandle(0)
      },
      startArchive,
      onEvent: (event) => events.push(event),
    })
    await stream.settled

    expect(events.filter((event) => event.type === 'exit')).toEqual([{ type: 'exit', exitCode: 0 }])
    expect(startArchive).toHaveBeenCalledOnce()
  })

  it.each([
    ['failed', 1],
    ['indeterminate', null],
  ] as const)('preserves %s validation and does not start archive', async (_label, exitCode) => {
    const events: CliStreamEvent[] = []
    const startArchive = vi.fn(() => settledHandle(0))

    const stream = startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'stderr', data: 'strict validation failed' })
        onEvent({ type: 'exit', exitCode })
        return settledHandle(exitCode)
      },
      startArchive,
      onEvent: (event) => events.push(event),
    })
    await stream.settled

    expect(startArchive).not.toHaveBeenCalled()
    expect(events.at(-1)).toEqual({ type: 'exit', exitCode })
  })

  it('cancels the active archive phase after validation settles', async () => {
    const archive = controlledHandle()
    const startArchive = vi.fn(() => archive.handle)
    const stream = startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return settledHandle(0)
      },
      startArchive,
      onEvent: vi.fn(),
    })
    await vi.waitFor(() => expect(startArchive).toHaveBeenCalledOnce())

    const cancellation = stream.cancel()
    expect(stream.cancel()).toBe(cancellation)

    await expect(cancellation).resolves.toEqual({ reason: 'cancelled', exitCode: null })
    expect(archive.cancel).toHaveBeenCalledOnce()
  })

  it('turns archive startup rejection into terminal indeterminate evidence', async () => {
    const events: CliStreamEvent[] = []
    const stream = startStrictArchiveStream({
      skipValidation: false,
      startValidate: (onEvent) => {
        onEvent({ type: 'exit', exitCode: 0 })
        return settledHandle(0)
      },
      startArchive: () => {
        throw new Error('archive process failed to start')
      },
      onEvent: (event) => events.push(event),
    })

    await expect(stream.settled).resolves.toEqual({ reason: 'startup-failed', exitCode: null })
    expect(events).toEqual([
      { type: 'stderr', data: 'archive process failed to start' },
      { type: 'exit', exitCode: null },
    ])
  })
})
