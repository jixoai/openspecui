/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove daemon control performs initial Pull and notice-driven replacement Pull.
 * 2. Prove unsupported hosted shells stay quiet while objective local failures remain visible.
 * 3. Prove open-in-browser posts only an encoded opaque Workspace id and parses typed failures.
 * 4. Prove one invalidation pulls the daemon-owned directory catalog and favorite commands stay server-owned.
 *
 * Original request (2026-07-29): "如果已经有 app daemon，那么默认投递到 app 中。"
 * Owner-reported defect (2026-07-31): HTML fallback from an old daemon must become a restart signal.
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
        projectDir: `/projects/${id}`,
        ownership: 'external',
        registeredAt: revision,
        managedGeneration: null,
        shutdown: 'close-only',
        git: null,
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
  it('posts only an encoded opaque Workspace id and surfaces a typed stale-id failure', async () => {
    const fetchControl = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: 'NOT_FOUND', message: 'Workspace is no longer registered.' },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        )
      )
    const control = createDaemonWorkspaceControl({
      baseUrl: 'http://127.0.0.1:14000',
      fetch: fetchControl,
      onSnapshot: vi.fn(),
      onError: vi.fn(),
    })

    await expect(control.openWorkspaceInBrowser('workspace/a')).resolves.toBeUndefined()
    expect(fetchControl).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:14000/api/daemon/workspaces/workspace%2Fa/open',
      { method: 'POST', cache: 'no-store', credentials: 'same-origin' }
    )
    await expect(control.openWorkspaceInBrowser('stale-id')).rejects.toThrow(
      'Workspace is no longer registered.'
    )
    expect(JSON.stringify(fetchControl.mock.calls)).not.toContain('http://backend.example')
  })

  it('does not reflect an invalid daemon payload into the App error surface', async () => {
    const control = createDaemonWorkspaceControl({
      baseUrl: 'http://127.0.0.1:14000',
      fetch: async () =>
        new Response(JSON.stringify({ ok: false, privateTarget: 'http://backend.example' })),
      onSnapshot: vi.fn(),
      onError: vi.fn(),
    })

    await expect(control.openWorkspaceInBrowser('workspace-a')).rejects.toThrow(
      'Daemon browser action returned an invalid response.'
    )
  })

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

  it('pulls daemon-owned Favorites/Recent after invalidation and posts favorite commands', async () => {
    let revision = 1
    let favorite = false
    const source = new TestEventSource()
    const directorySnapshots: unknown[] = []
    const fetchControl = vi.fn(async (input: string, init: RequestInit) => {
      if (input.endsWith('/api/daemon/workspaces')) return snapshotResponse(revision, [])
      if (input.endsWith('/api/daemon/workspace-directories/favorite')) {
        const body: unknown = JSON.parse(String(init.body))
        favorite =
          typeof body === 'object' && body !== null && 'favorite' in body
            ? body.favorite === true
            : false
        return new Response(JSON.stringify({ ok: true }))
      }
      if (input.endsWith('/api/daemon/workspace-directories')) {
        return new Response(
          JSON.stringify({
            revision,
            catalog: {
              version: 1,
              entries: [{ canonicalPath: '/projects/a', favorite, lastOpenedAt: 7 }],
            },
          })
        )
      }
      throw new Error(`Unexpected daemon request: ${input}`)
    })
    const control = createDaemonWorkspaceControl({
      baseUrl: 'http://127.0.0.1:14000',
      fetch: fetchControl,
      createEventSource: () => source,
      onSnapshot: () => {},
      onDirectorySnapshot: (snapshot) => directorySnapshots.push(snapshot),
      onError: (error) => {
        throw error
      },
    })

    await control.start()
    expect(directorySnapshots).toMatchObject([
      { revision: 1, catalog: { entries: [{ canonicalPath: '/projects/a', favorite: false }] } },
    ])

    await control.setDirectoryFavorite('/projects/a', true)
    revision = 2
    source.emit(revision)
    await vi.waitFor(() => expect(directorySnapshots).toHaveLength(2))
    expect(directorySnapshots[1]).toMatchObject({
      revision: 2,
      catalog: { entries: [{ canonicalPath: '/projects/a', favorite: true }] },
    })
    expect(fetchControl.mock.calls.some(([url]) => url.endsWith('/favorite'))).toBe(true)
    control.stop()
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

  it('turns an old daemon directory HTML fallback into an explicit restart signal', async () => {
    const onError = vi.fn()
    const fetchControl = vi
      .fn<(input: string, init: RequestInit) => Promise<Response>>()
      .mockResolvedValueOnce(snapshotResponse(1, []))
      .mockResolvedValueOnce(
        new Response('<!doctype html><html><body>Hosted App</body></html>', {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )
    const control = createDaemonWorkspaceControl({
      baseUrl: 'http://127.0.0.1:14000',
      fetch: fetchControl,
      onSnapshot: vi.fn(),
      onDirectorySnapshot: vi.fn(),
      onError,
    })

    await expect(control.start()).resolves.toBe('unsupported')
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'The OpenSpecUI App daemon is outdated. Restart the App daemon to continue.',
      })
    )
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
