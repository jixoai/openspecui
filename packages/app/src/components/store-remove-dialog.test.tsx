/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove explicit destructive Store confirmation content and typing gate.
 * 2. Prove the dialog submits its captured origin to the route-owned mutation operation.
 * 3. Prove HTTP rejection stays repairable and only matching ledger success closes the dialog.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
// @vitest-environment jsdom

import type {
  StoreMutationEnvelope,
  StoreMutationStartResponse,
} from '@openspecui/core/store-mutation-protocol'
import type { StoreDoctorStore } from '@openspecui/core/store-types'
import {
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BackendStoreMutationRequestError } from '../lib/backend-client'
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

  it('does not close from terminal-looking HTTP admission without ledger settlement', async () => {
    let closed = false
    const admission = {
      requestId: 'r1',
      envUri: 'openspecui-env://1/aaa',
      kind: 'remove',
      status: 'succeeded',
      storeId: 'design-system',
      result: { exitStatus: 0 },
      observedAt: 1,
      rejoined: true,
    } satisfies StoreMutationStartResponse
    const removeStore = vi.fn(async () => admission)
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
    expect(closed).toBe(false)
    expect(removeStore).toHaveBeenCalledWith(AUTHORITY, expect.any(String), 'design-system')
  })

  it('keeps the real form open with a typed rejection and creates no lifecycle evidence', async () => {
    let closed = false
    const removeStore = vi.fn(async () => {
      throw new BackendStoreMutationRequestError(403, 'Forbidden')
    })
    await renderAt(
      wrapInRouter(
        <StoreRemoveDialog
          store={STORE}
          authority={AUTHORITY}
          authorityCurrent
          removeStore={removeStore}
          onClose={() => (closed = true)}
        />
      )
    )
    fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
      target: { value: 'design-system' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))

    await screen.findByText('Store mutation request failed: 403 Forbidden.')
    expect(closed).toBe(false)
    expect(screen.getByRole('form', { name: 'Remove Store files' })).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('closes only after the matching ledger record is observed as succeeded', async () => {
    let closed = false

    function Harness() {
      const [records, setRecords] = useState<readonly StoreMutationEnvelope[]>([])
      return (
        <StoreRemoveDialog
          store={STORE}
          authority={AUTHORITY}
          authorityCurrent
          mutationRecords={records}
          removeStore={async (_authority, requestId) => {
            queueMicrotask(() => {
              setRecords([
                {
                  requestId,
                  envUri: 'openspecui-env://1/aaa',
                  kind: 'remove',
                  status: 'succeeded',
                  storeId: 'design-system',
                  result: { exitStatus: 0 },
                  observedAt: 2,
                },
              ])
            })
            return {
              requestId,
              envUri: 'openspecui-env://1/aaa',
              kind: 'remove',
              status: 'accepted',
              storeId: 'design-system',
              observedAt: 1,
              rejoined: false,
            }
          }}
          onClose={() => (closed = true)}
        />
      )
    }

    await renderAt(wrapInRouter(<Harness />))
    fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
      target: { value: 'design-system' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))
    await waitFor(() => expect(closed).toBe(true))
  })

  it('keeps failed ledger evidence visible without closing or automatic retry', async () => {
    let closed = false
    let attempts = 0

    function Harness() {
      const [records, setRecords] = useState<readonly StoreMutationEnvelope[]>([])
      return (
        <StoreRemoveDialog
          store={STORE}
          authority={AUTHORITY}
          authorityCurrent
          mutationRecords={records}
          removeStore={async (_authority, requestId) => {
            attempts += 1
            queueMicrotask(() => {
              setRecords([
                {
                  requestId,
                  envUri: 'openspecui-env://1/aaa',
                  kind: 'remove',
                  status: 'failed',
                  storeId: 'design-system',
                  result: { exitStatus: 1, stderr: 'CLI remove failed.' },
                  observedAt: 2,
                },
              ])
            })
            return {
              requestId,
              envUri: 'openspecui-env://1/aaa',
              kind: 'remove',
              status: 'accepted',
              storeId: 'design-system',
              observedAt: 1,
              rejoined: false,
            }
          }}
          onClose={() => (closed = true)}
        />
      )
    }

    await renderAt(wrapInRouter(<Harness />))
    fireEvent.change(screen.getByLabelText('Type the Store id to confirm'), {
      target: { value: 'design-system' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Remove Store' }))
    await screen.findByText('CLI remove failed.')
    expect(screen.getByRole('status').textContent).toContain('Failed')
    expect(closed).toBe(false)
    expect(attempts).toBe(1)
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
