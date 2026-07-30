/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove an external serve Stop is offered only when the lease advertises owner-handled shutdown (3.0e).
 * 2. Prove a lease without the capability resolves to presentation Close only — never an inferred Stop.
 *
 * Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
 * Spec: cli-commands › "Stop an external foreground project".
 */
import { describe, expect, it, vi } from 'vitest'
import {
  resolveExternalServeTaskCommand,
  unsupportedExternalServeShutdown,
  type ExternalServeShutdownCapability,
  type ExternalServeShutdownResult,
} from './external-serve-shutdown'

describe('external serve shutdown capability (3.0e)', () => {
  it('offers Stop when the exact current lease advertises owner-handled shutdown', () => {
    const success: ExternalServeShutdownResult = { ok: true }
    const capability: ExternalServeShutdownCapability = {
      isAvailable: () => true,
      request: vi.fn(async () => success),
    }
    expect(resolveExternalServeTaskCommand(capability)).toEqual({ kind: 'stop', capability })
  })

  it('delegates Stop to the owning foreground process and never signals it directly', async () => {
    const success: ExternalServeShutdownResult = { ok: true }
    const request = vi.fn(async () => success)
    const capability: ExternalServeShutdownCapability = { isAvailable: () => true, request }
    const command = resolveExternalServeTaskCommand(capability)
    if (command.kind !== 'stop') throw new Error('expected stop')
    const result = await command.capability.request()
    expect(result).toEqual({ ok: true })
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('resolves to presentation Close only when the lease omits shutdown capability', () => {
    expect(resolveExternalServeTaskCommand(null)).toEqual({ kind: 'close-only' })
    expect(resolveExternalServeTaskCommand(undefined)).toEqual({ kind: 'close-only' })
  })

  it('resolves to Close only when the capability is present but unavailable', () => {
    const unavailable: ExternalServeShutdownResult = {
      ok: false,
      code: 'unavailable',
      message: 'no',
    }
    const capability: ExternalServeShutdownCapability = {
      isAvailable: () => false,
      request: vi.fn(async () => unavailable),
    }
    expect(resolveExternalServeTaskCommand(capability)).toEqual({ kind: 'close-only' })
  })

  it('the unsupported capability never claims it can stop and reports unsupported', async () => {
    expect(unsupportedExternalServeShutdown.isAvailable()).toBe(false)
    const result = await unsupportedExternalServeShutdown.request()
    expect(result).toEqual({
      ok: false,
      code: 'unsupported',
      message: 'This backend does not advertise owner-handled shutdown.',
    })
  })
})
