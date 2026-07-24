/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove explicit destructive Store confirmation content and typing gate.
 * 2. Prove the dialog submits its captured origin to the route-owned mutation operation.
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
import type { StoreActionAuthority } from '../lib/store-action'
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

const AUTHORITY: StoreActionAuthority = {
  tabId: 'tab-a',
  sessionId: 'session-a',
  apiBaseUrl: 'http://localhost:3100',
  tabCreatedAt: 1,
  observationGeneration: 7,
}

const rejectRemove = async (): Promise<null> => null

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
    await renderAt(
      wrapInRouter(
        <StoreRemoveDialog store={STORE} removeStore={rejectRemove} onClose={() => {}} />
      )
    )
    const text = document.body.textContent ?? ''
    // 9.9：破坏性操作必须命名 environment/host/Store/checkout path。
    expect(text).toContain('Environment')
    expect(text).toContain('Host')
    expect(text).toContain('design-system')
    expect(text).toContain('/Users/test/stores/design-system')
  })

  it('disables remove until the Store id is typed correctly', async () => {
    await renderAt(
      wrapInRouter(
        <StoreRemoveDialog
          store={STORE}
          authority={AUTHORITY}
          authorityCurrent
          removeStore={rejectRemove}
          onClose={() => {}}
        />
      )
    )
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
    const removeStore = vi.fn(async () => ({
      requestId: 'r1',
      envUri: 'openspecui-env://1/aaa',
      kind: 'remove' as const,
      status: 'succeeded' as const,
      storeId: 'design-system',
      result: { exitStatus: 0 },
      observedAt: 1,
      rejoined: true,
    }))
    await renderAt(
      wrapInRouter(
        <StoreRemoveDialog
          store={STORE}
          envUri="openspecui-env://1/aaa"
          authority={AUTHORITY}
          authorityCurrent
          removeStore={removeStore}
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
    expect(removeStore).toHaveBeenCalledWith(AUTHORITY, expect.any(String), 'design-system')
  })

  it('renders an actionable message when its captured authority is retired', async () => {
    await renderAt(
      wrapInRouter(
        <StoreRemoveDialog
          store={STORE}
          authority={AUTHORITY}
          removeStore={rejectRemove}
          onClose={() => {}}
        />
      )
    )
    expect(document.body.textContent).toContain(
      'The environment refreshed after this dialog opened. Close and reopen it before removing files.'
    )
  })
})
