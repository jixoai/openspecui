/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove two App owners converge Favorites/Recent through daemon snapshots and SSE invalidation.
 * 2. Prove favorite commands mutate backend state without writing the catalog to localStorage.
 *
 * Owner correction (2026-07-31): "Favorites Recent 这些数据你是不是存储在前端？要存储在后端啊"
 */
// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppDaemonWorkspaceOwner, useAppDaemonWorkspace } from './app-daemon-workspace-owner'

class CatalogEventSource {
  readonly listeners = new Set<EventListener>()

  addEventListener(_type: string, listener: EventListener): void {
    this.listeners.add(listener)
  }

  removeEventListener(_type: string, listener: EventListener): void {
    this.listeners.delete(listener)
  }

  close(): void {
    this.listeners.clear()
  }

  emit(revision: number): void {
    const event = new MessageEvent('invalidate', { data: JSON.stringify({ revision }) })
    for (const listener of this.listeners) listener(event)
  }
}

function CatalogProbe({ name }: { readonly name: string }) {
  const daemon = useAppDaemonWorkspace()
  const favorite = daemon.directoryCatalog.entries[0]?.favorite ?? false
  return (
    <div>
      <output aria-label={`${name} favorite`}>{String(favorite)}</output>
      <button type="button" onClick={() => void daemon.setDirectoryFavorite('/projects/a', true)}>
        Favorite from {name}
      </button>
    </div>
  )
}

describe('App daemon directory catalog convergence', () => {
  const originalFetch = global.fetch
  const originalEventSource = global.EventSource
  const sources: CatalogEventSource[] = []
  let revision = 1
  let favorite = false

  beforeEach(() => {
    localStorage.clear()
    revision = 1
    favorite = false
    sources.length = 0
    global.EventSource = class {
      readonly source = new CatalogEventSource()

      constructor() {
        sources.push(this.source)
      }

      addEventListener(type: string, listener: EventListener): void {
        this.source.addEventListener(type, listener)
      }

      removeEventListener(type: string, listener: EventListener): void {
        this.source.removeEventListener(type, listener)
      }

      close(): void {
        this.source.close()
      }
    } as unknown as typeof EventSource
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/daemon/workspaces')) {
        return new Response(JSON.stringify({ revision, workspaces: [] }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (url.endsWith('/api/daemon/workspace-directories')) {
        return new Response(
          JSON.stringify({
            revision,
            catalog: {
              version: 1,
              entries: [{ canonicalPath: '/projects/a', favorite, lastOpenedAt: 7 }],
            },
          }),
          { headers: { 'Content-Type': 'application/json' } }
        )
      }
      if (url.endsWith('/api/daemon/workspace-directories/favorite')) {
        const body: unknown = JSON.parse(String(init?.body))
        favorite =
          typeof body === 'object' && body !== null && 'favorite' in body
            ? body.favorite === true
            : false
        revision += 1
        for (const source of sources) source.emit(revision)
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw new Error(`Unexpected daemon request: ${url}`)
    }) as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
    global.EventSource = originalEventSource
  })

  it('converges two windows through backend state and leaves localStorage empty', async () => {
    render(
      <>
        <AppDaemonWorkspaceOwner>
          <CatalogProbe name="window A" />
        </AppDaemonWorkspaceOwner>
        <AppDaemonWorkspaceOwner>
          <CatalogProbe name="window B" />
        </AppDaemonWorkspaceOwner>
      </>
    )
    await waitFor(() =>
      expect(screen.getByLabelText('window A favorite').textContent).toBe('false')
    )
    expect(screen.getByLabelText('window B favorite').textContent).toBe('false')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Favorite from window A' }))
    })
    await waitFor(() => expect(screen.getByLabelText('window A favorite').textContent).toBe('true'))
    expect(screen.getByLabelText('window B favorite').textContent).toBe('true')
    expect(localStorage.getItem('openspecui-app:workspace-directory-catalog')).toBeNull()
  })
})
