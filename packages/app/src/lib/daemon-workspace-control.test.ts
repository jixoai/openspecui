/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove daemon control performs initial Pull and notice-driven replacement Pull.
 * 2. Prove unsupported hosted shells stay quiet while objective local failures remain visible.
 *
 * Original request (2026-07-29): "如果已经有 app daemon，那么默认投递到 app 中。"
 */
import { describe, expect, it, vi } from 'vitest'
import {
  createDaemonWorkspaceControl,
  type DaemonWorkspaceEventSource,
} from './daemon-workspace-control'

function snapshotResponse(revision: number, ids: readonly string[]): Response {
  return new Response(
    JSON.stringify({
      revision,
      workspaces: ids.map((id) => ({
        id,
        backendUrl: `http://127.0.0.1:${id === 'workspace-a' ? 3100 : 3200}`,
        credential: `credential-${id}`,
      })),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
  )
}

class TestEventSource implements DaemonWorkspaceEventSource {
  readonly listeners = new Set<EventListener>()
  readonly close = vi.fn()

  addEventListener(_type: 'invalidate', listener: EventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: 'invalidate', listener: EventListener): void {
    this.listeners.delete(listener)
  }

  emit(revision: number): void {
    const event = new MessageEvent('invalidate', { data: JSON.stringify({ revision }) })
    for (const listener of this.listeners) listener(event)
  }
}

describe('daemon Workspace control', () => {
  it('pulls the initial snapshot and replaces it after a typed invalidation', async () => {
    const responses = [
      snapshotResponse(1, ['workspace-a']),
      snapshotResponse(2, ['workspace-a', 'workspace-b']),
    ]
    const fetchSnapshot = vi.fn(async () => responses.shift() ?? snapshotResponse(2, []))
    const source = new TestEventSource()
    const snapshots: unknown[] = []
    const errors: Error[] = []
    const control = createDaemonWorkspaceControl({
      baseUrl: 'http://127.0.0.1:14000',
      fetch: fetchSnapshot,
      createEventSource: () => source,
      onSnapshot: (snapshot) => snapshots.push(snapshot),
      onError: (error) => errors.push(error),
    })

    await expect(control.start()).resolves.toBe('supported')
    expect(snapshots).toMatchObject([{ revision: 1, workspaces: [{ id: 'workspace-a' }] }])

    source.emit(2)
    await vi.waitFor(() => expect(snapshots).toHaveLength(2))
    expect(snapshots[1]).toMatchObject({
      revision: 2,
      workspaces: [{ id: 'workspace-a' }, { id: 'workspace-b' }],
    })
    expect(errors).toEqual([])

    control.stop()
    expect(source.close).toHaveBeenCalledOnce()
    expect(source.listeners).toHaveLength(0)
  })

  it.each([
    new Response('missing', { status: 404 }),
    new Response('<main>Hosted App</main>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
  ])('quietly treats a missing daemon control surface as unsupported', async (response) => {
    const createEventSource = vi.fn(() => new TestEventSource())
    const onError = vi.fn()
    const control = createDaemonWorkspaceControl({
      baseUrl: 'https://app.example.com',
      fetch: vi.fn(async () => response),
      createEventSource,
      onSnapshot: vi.fn(),
      onError,
    })

    await expect(control.start()).resolves.toBe('unsupported')
    expect(createEventSource).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('surfaces an objective local control failure and remains available for later invalidations', async () => {
    const source = new TestEventSource()
    const onError = vi.fn()
    const control = createDaemonWorkspaceControl({
      baseUrl: 'http://127.0.0.1:14000',
      fetch: vi.fn(async () => new Response('failure', { status: 500 })),
      createEventSource: () => source,
      onSnapshot: vi.fn(),
      onError,
    })

    await expect(control.start()).resolves.toBe('supported')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Daemon Workspace snapshot failed with HTTP 500.' })
    )
    expect(source.listeners).toHaveLength(1)
    control.stop()
  })
})
