/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove explicit destructive Store confirmation content and typing gate.
 * 2. Prove removal crosses the backend client only with current selected authority.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
// @vitest-environment jsdom

import type { StoreDoctorStore } from '@openspecui/core/store-types'
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoreRemoveDialog } from './store-remove-dialog'

const STORE: StoreDoctorStore = {
  id: 'design-system',
  root: '/Users/test/stores/design-system',
  metadata_path: '/Users/test/stores/design-system/.openspec-store.json',
  // openspec_root must match CliOpenSpecRootInspectionSchema (config/specs/changes/archive/healthy/status required).
  openspec_root: {
    present: true,
    config: { present: true },
    specs: { present: true },
    changes: { present: true },
    archive: { present: true },
    healthy: true,
    status: [],
  },
  metadata: { present: true, valid: true, id: 'design-system', remote: null },
  git: {
    is_repository: true,
    has_commits: true,
    has_uncommitted_changes: false,
    has_remote: true,
    origin_url: 'git@github.com:test/design-system.git',
  },
  status: [],
}

async function renderAt(element: ReactElement): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return { container, root }
}

// StoreRemoveDialog 使用 lucide-react 但无 router 链接；为安全起见包一层 router。
function wrapInRouter(element: ReactElement): ReactElement {
  const rootRoute = createRootRouteWithContext<{ dummy: null }>()({ component: () => element })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    context: { dummy: null },
  })
  return <RouterProvider router={router} />
}

describe('StoreRemoveDialog', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('names environment, host, Store, and checkout path for explicit confirmation', async () => {
    await renderAt(wrapInRouter(<StoreRemoveDialog store={STORE} onClose={() => {}} />))
    const text = document.body.textContent ?? ''
    // 9.9：破坏性操作必须命名 environment/host/Store/checkout path。
    expect(text).toContain('Environment')
    expect(text).toContain('Host')
    expect(text).toContain('design-system')
    expect(text).toContain('/Users/test/stores/design-system')
  })

  it('disables remove until the Store id is typed correctly', async () => {
    await renderAt(wrapInRouter(<StoreRemoveDialog store={STORE} onClose={() => {}} />))
    const removeButton = screen.getByRole('button', { name: 'Remove Store' })
    expect(removeButton.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
        target: { value: 'wrong-id' },
      })
    })
    expect(removeButton.hasAttribute('disabled')).toBe(true)

    await act(async () => {
      fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
        target: { value: 'design-system' },
      })
    })
    expect(removeButton.hasAttribute('disabled')).toBe(false)
  })

  it('calls onClose when remove is confirmed', async () => {
    let closed = false
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        result: {
          data: {
            requestId: 'r1',
            kind: 'remove',
            status: 'succeeded',
            storeId: 'design-system',
            observedAt: 1,
          },
        },
      }),
    })) as unknown as typeof fetch
    vi.stubGlobal('fetch', fetchMock)
    try {
      await renderAt(
        wrapInRouter(
          <StoreRemoveDialog
            store={STORE}
            envUri="openspecui-env://1/aaa"
            authority={{ apiBaseUrl: 'http://localhost:3100', isCurrent: () => true }}
            onClose={() => (closed = true)}
          />
        )
      )
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
          target: { value: 'design-system' },
        })
      })
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))
      })
      expect(closed).toBe(true)
      expect(fetchMock).toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not dispatch removal after selected authority is retired', async () => {
    let closed = false
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    try {
      await renderAt(
        wrapInRouter(
          <StoreRemoveDialog
            store={STORE}
            envUri="openspecui-env://1/aaa"
            authority={{ apiBaseUrl: 'http://localhost:3100', isCurrent: () => false }}
            onClose={() => (closed = true)}
          />
        )
      )
      await act(async () => {
        fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
          target: { value: 'design-system' },
        })
      })
      expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Remove Store' }).disabled).toBe(
        false
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))
      })
      expect(fetchMock).not.toHaveBeenCalled()
      expect(closed).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
