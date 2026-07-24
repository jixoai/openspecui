/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove admission returns before terminal settlement and publishes the Server lifecycle.
 * 2. Prove request-id deduplication and terminal-before-publication invalidation.
 * 3. Distinguish deterministic failure from explicit post-admission lost terminal truth.
 *
 * Original request (2026-07-15): "Store 变更是 backend-owned 操作。"
 * Section 8.7/8.8 unit coverage.
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { asEnvUri } from '@openspecui/core'
import { describe, expect, it, vi } from 'vitest'
import { StoreMutationService } from './store-mutation-service.js'

const envUri = asEnvUri('openspecui-env://1/abc')

function result(exitStatus: number | null) {
  return { exitStatus, stdout: 'out', stderr: 'err' }
}

describe('StoreMutationService', () => {
  it('returns accepted before terminal settlement and publishes accepted -> running -> succeeded', async () => {
    const invalidate = vi.fn()
    const service = new StoreMutationService(invalidate)
    const events: string[] = []
    const terminal = Promise.withResolvers<void>()
    service.subscribe((event) => {
      if (event.type === 'changed') {
        events.push(event.record.status)
        if (event.record.status === 'succeeded') terminal.resolve()
      }
    })
    const mutation = service.start({
      requestId: 'r1',
      envUri,
      kind: 'setup',
      run: async () => result(0),
    })
    expect(mutation).toEqual({
      record: expect.objectContaining({ status: 'accepted' }),
      rejoined: false,
    })
    await terminal.promise
    expect(events).toEqual(['accepted', 'running', 'succeeded'])
    expect(service.list()[0]?.result?.exitStatus).toBe(0)
    expect(invalidate).toHaveBeenCalledOnce()
  })

  it('runs accepted -> running -> failed for a nonzero exit', async () => {
    const service = new StoreMutationService(() => {})
    const terminal = Promise.withResolvers<void>()
    service.subscribe((event) => {
      if (event.type === 'changed' && event.record.status === 'failed') terminal.resolve()
    })
    const mutation = service.start({
      requestId: 'r2',
      envUri,
      kind: 'register',
      run: async () => result(1),
    })
    expect(mutation.record.status).toBe('accepted')
    await terminal.promise
    expect(service.list()[0]?.status).toBe('failed')
  })

  it('reports exit-0 contract drift as deterministic failed evidence', async () => {
    const service = new StoreMutationService(() => {})
    const terminal = Promise.withResolvers<void>()
    service.subscribe((event) => {
      if (event.type === 'changed' && event.record.status === 'failed') terminal.resolve()
    })
    service.start({
      requestId: 'r2-contract-drift',
      envUri,
      kind: 'register',
      run: async () => ({ ...result(0), contractError: 'required field missing' }),
    })
    await terminal.promise
    expect(service.list()[0]).toMatchObject({
      status: 'failed',
      result: { exitStatus: 0, contractError: 'required field missing' },
    })
  })

  it('reports a deterministic thrown operation as failed rather than indeterminate', async () => {
    const service = new StoreMutationService(() => {})
    const terminal = Promise.withResolvers<void>()
    service.subscribe((event) => {
      if (event.type === 'changed' && event.record.status === 'failed') terminal.resolve()
    })
    service.start({
      requestId: 'r3',
      envUri,
      kind: 'remove',
      run: async () => {
        throw new Error('cli disappeared')
      },
    })
    await terminal.promise
    expect(service.list()[0]).toMatchObject({
      status: 'failed',
      result: { stderr: 'cli disappeared' },
    })
  })

  it('deduplicates starts by request id: a repeated start rejoins the existing record', async () => {
    const service = new StoreMutationService(() => {})
    let runCount = 0
    const run = async () => {
      runCount += 1
      return result(0)
    }
    const first = service.start({ requestId: 'r4', envUri, kind: 'setup', run })
    const second = service.start({ requestId: 'r4', envUri, kind: 'setup', run })
    expect(first.record.requestId).toBe('r4')
    expect(second).toEqual({ record: first.record, rejoined: true })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(runCount).toBe(1)
  })

  it('markIndeterminate records only explicit post-admission lost terminal truth', async () => {
    const service = new StoreMutationService(() => {})
    // Seed an accepted mutation without awaiting run completion.
    void service.start({
      requestId: 'r5',
      envUri,
      kind: 'unregister',
      run: () => new Promise(() => {}),
    })
    const indeterminate = await service.markIndeterminate('r5', 'lost during disconnect')
    expect(indeterminate?.status).toBe('indeterminate')
    expect(service.list().find((m) => m.requestId === 'r5')?.status).toBe('indeterminate')
  })

  it('keeps exactly one terminal record when lost truth races a late CLI completion', async () => {
    const service = new StoreMutationService(() => {})
    const events: string[] = []
    const release = Promise.withResolvers<void>()
    service.subscribe((event) => {
      if (event.type === 'changed') events.push(event.record.status)
    })
    service.start({
      requestId: 'r6',
      envUri,
      kind: 'remove',
      run: async () => {
        await release.promise
        return result(0)
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await service.markIndeterminate('r6', 'terminal result was lost')
    release.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(events).toEqual(['accepted', 'running', 'indeterminate'])
    expect(service.list()).toEqual([
      expect.objectContaining({ requestId: 'r6', status: 'indeterminate' }),
    ])
  })
})
