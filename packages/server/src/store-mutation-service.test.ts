/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove Store mutation lifecycle: accepted -> running -> succeeded | failed | indeterminate.
 * 2. Prove request-id deduplication does not start a duplicate.
 * 3. Prove indeterminate loss is never fabricated as failure/cancellation.
 *
 * Original request (2026-07-15): "Store 变更是 backend-owned 操作。"
 * Section 8.7/8.8 unit coverage.
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { asEnvUri } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { StoreMutationService } from './store-mutation-service.js'

const envUri = asEnvUri('openspecui-env://1/abc')

function result(exitStatus: number | null) {
  return { exitStatus, stdout: 'out', stderr: 'err' }
}

describe('StoreMutationService', () => {
  it('runs accepted -> running -> succeeded for an exit-0 result', async () => {
    const service = new StoreMutationService()
    const events: string[] = []
    service.subscribe((m) => events.push(m.status))
    const mutation = await service.start({
      requestId: 'r1',
      envUri,
      kind: 'setup',
      run: async () => result(0),
    })
    expect(mutation.status).toBe('succeeded')
    expect(events).toEqual(['accepted', 'running', 'succeeded'])
    expect(mutation.result?.exitStatus).toBe(0)
  })

  it('runs accepted -> running -> failed for a nonzero exit', async () => {
    const service = new StoreMutationService()
    const mutation = await service.start({
      requestId: 'r2',
      envUri,
      kind: 'register',
      run: async () => result(1),
    })
    expect(mutation.status).toBe('failed')
  })

  it('reports indeterminate when the operation throws (never fabricated as failure)', async () => {
    const service = new StoreMutationService()
    const mutation = await service.start({
      requestId: 'r3',
      envUri,
      kind: 'remove',
      run: async () => {
        throw new Error('cli disappeared')
      },
    })
    expect(mutation.status).toBe('indeterminate')
    expect(mutation.result?.stderr).toContain('cli disappeared')
  })

  it('deduplicates starts by request id: a repeated start rejoins the existing record', async () => {
    const service = new StoreMutationService()
    let runCount = 0
    const run = async () => {
      runCount += 1
      return result(0)
    }
    const first = service.start({ requestId: 'r4', envUri, kind: 'setup', run })
    const second = service.start({ requestId: 'r4', envUri, kind: 'setup', run })
    const [a, b] = await Promise.all([first, second])
    expect(a.requestId).toBe('r4')
    expect(b.requestId).toBe('r4')
    expect(runCount).toBe(1)
  })

  it('markIndeterminate converts an active mutation to indeterminate without fabricating failure', () => {
    const service = new StoreMutationService()
    // Seed an accepted mutation without awaiting run completion.
    void service.start({
      requestId: 'r5',
      envUri,
      kind: 'unregister',
      run: () => new Promise(() => {}),
    })
    const indeterminate = service.markIndeterminate('r5', 'lost during disconnect')
    expect(indeterminate?.status).toBe('indeterminate')
    expect(service.list().find((m) => m.requestId === 'r5')?.status).toBe('indeterminate')
  })
})
