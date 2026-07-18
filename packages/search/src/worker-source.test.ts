/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify the generated worker runtime preserves project Search scope semantics.
 *
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 */
import { Worker } from 'node:worker_threads'
import { afterEach, describe, expect, it } from 'vitest'
import type { SearchWorkerRequest, SearchWorkerResponse } from './protocol.js'
import { buildNodeWorkerSource } from './worker-source.js'

const workers: Worker[] = []

afterEach(async () => {
  await Promise.all(workers.splice(0).map((worker) => worker.terminate()))
})

function send(worker: Worker, request: SearchWorkerRequest): Promise<SearchWorkerResponse> {
  return new Promise((resolve, reject) => {
    worker.once('message', resolve)
    worker.once('error', reject)
    worker.postMessage(request)
  })
}

describe('generated worker Search runtime', () => {
  it('filters by project scope before scoring and limiting results', async () => {
    const worker = new Worker(buildNodeWorkerSource(), { eval: true })
    workers.push(worker)

    await send(worker, {
      id: 'init',
      type: 'init',
      docs: [
        {
          id: 'change:add-auth',
          kind: 'change',
          scope: 'active-root',
          title: 'Authentication authentication',
          href: '/changes/add-auth',
          path: 'openspec/changes/add-auth',
          content: 'authentication',
          updatedAt: 20,
        },
        {
          id: 'archive:old-auth',
          kind: 'archive',
          scope: 'active-root',
          title: 'Authentication authentication authentication',
          href: '/archive/old-auth',
          path: 'openspec/changes/archive/old-auth',
          content: 'authentication',
          updatedAt: 30,
        },
        {
          id: 'spec:reference:platform:auth',
          kind: 'spec',
          scope: 'referenced-specs',
          title: 'Authentication',
          href: '/specs/reference/platform/auth',
          path: 'reference:platform:openspec/specs/auth/spec.md',
          content: 'authentication',
          updatedAt: 10,
        },
      ],
    })

    const response = await send(worker, {
      id: 'search',
      type: 'search',
      query: { query: 'authentication', scope: 'referenced-specs', limit: 1 },
    })

    expect(response).toEqual({
      id: 'search',
      type: 'results',
      hits: [
        expect.objectContaining({
          documentId: 'spec:reference:platform:auth',
          scope: 'referenced-specs',
        }),
      ],
    })
  })
})
