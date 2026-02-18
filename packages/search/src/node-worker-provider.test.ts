import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { NodeWorkerSearchProvider } from './node-worker-provider.js'

const runtime = vi.hoisted(() => ({
  mode: 'invalid' as 'invalid' | 'ok',
}))

vi.mock('node:worker_threads', () => ({
  Worker: class MockWorker extends EventEmitter {
    postMessage(payload: unknown): void {
      queueMicrotask(() => {
        if (runtime.mode === 'invalid') {
          this.emit('message', { invalid: true })
          return
        }

        if (
          typeof payload !== 'object'
          || payload == null
          || !('id' in payload)
          || !('type' in payload)
        ) {
          return
        }

        const { id, type } = payload as { id: string; type: string }
        if (type === 'search') {
          this.emit('message', { id, type: 'results', hits: [] })
        } else {
          this.emit('message', { id, type: 'ok' })
        }
      })
    }

    async terminate(): Promise<number> {
      return 0
    }
  },
}))

describe('NodeWorkerSearchProvider', () => {
  it('rejects pending requests when worker response payload is invalid', async () => {
    runtime.mode = 'invalid'
    const provider = new NodeWorkerSearchProvider()

    await expect(provider.init([])).rejects.toThrow('Invalid worker response payload')

    await provider.dispose()
  })

  it('continues to work when next responses become valid', async () => {
    runtime.mode = 'ok'
    const provider = new NodeWorkerSearchProvider()

    await expect(provider.init([])).resolves.toBeUndefined()
    await expect(provider.search({ query: 'auth' })).resolves.toEqual([])

    await provider.dispose()
  })
})
