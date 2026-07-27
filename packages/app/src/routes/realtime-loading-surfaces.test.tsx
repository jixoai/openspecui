/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Prove App connection and environment surfaces distinguish unresolved observations from empty truth.
 * 2. Prove Store Inventory and Inspector use stable admission geometry instead of loading copy.
 * 3. Prove Context Matrix does not claim an empty relationship set while Root evidence is pending.
 * 4. Prove retained rows remain visible inside the shared local revalidation cue.
 *
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 */
// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConnectionsRoute } from './connections'
import { ContextMatrixRoute } from './context-matrix'
import { EnvironmentRoute } from './environment'
import { StoreInspectorRoute } from './store-inspector'
import { StoreInventoryRoute } from './store-inventory'

const mocks = vi.hoisted(() => ({
  connectionObservations: vi.fn(),
  connections: vi.fn(),
  environmentObservation: vi.fn(),
  storeData: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown
  }) => select({ location: { pathname: '/stores' } }),
}))

vi.mock('../lib/connection-observation', () => ({
  useConnectionObservations: mocks.connectionObservations,
}))

vi.mock('../lib/use-connections', () => ({
  useConnections: mocks.connections,
  useConnectionsActions: () => ({ setState: vi.fn() }),
}))

vi.mock('../lib/use-environment', () => ({
  projectRootObservation: (observation: unknown) => observation,
  useEnvironmentObservation: mocks.environmentObservation,
}))

vi.mock('../lib/use-active-backend', () => ({
  useActiveBackend: () => ({
    active: {
      apiBaseUrl: 'http://localhost:3100',
      generation: 1,
      sessionId: 'session-a',
      tabId: 'tab-a',
    },
  }),
}))

vi.mock('../lib/use-store-data', () => ({ useStoreData: mocks.storeData }))

vi.mock('../components/store-mutation-lifecycle', () => ({
  StoreMutationLifecycleEvidence: () => null,
  useStoreMutationLifecycle: () => ({ registerAdmission: null }),
}))

vi.mock('../lib/mutation-observation-provider', () => ({
  useMutationObservations: () => ({ records: [] }),
}))

vi.mock('../lib/store-action', () => ({
  correlateStoreMutationAdmissions: () => vi.fn(),
  isSameStoreActionAuthority: () => true,
  useStoreMutationDispatcher: () => vi.fn(),
}))

function checkingObservation() {
  return {
    apiBaseUrl: 'http://localhost:3100',
    current: true,
    generation: 1,
    health: null,
    reachability: 'checking',
    rootAttempt: { error: null, status: 'loading' },
    rootEvidence: null,
    sessionId: 'session-a',
    tabId: 'tab-a',
  }
}

describe('App realtime loading surfaces', () => {
  beforeEach(() => {
    mocks.connectionObservations.mockReset().mockReturnValue({ observations: [] })
    mocks.connections.mockReset().mockReturnValue({ activeTabId: null, tabs: [] })
    mocks.environmentObservation.mockReset().mockReturnValue({
      environments: [],
      error: null,
      isLoading: false,
      projectContexts: [],
    })
    mocks.storeData.mockReset().mockReturnValue({
      canMutate: false,
      inspector: undefined,
      inspectorError: null,
      inventory: undefined,
      inventoryError: null,
      isInspectorLoading: false,
      isInspectorUpdating: false,
      isInventoryLoading: false,
      isInventoryUpdating: false,
      refresh: vi.fn(),
    })
  })

  it('keeps a Connection row visible while its reachability observation revalidates', () => {
    mocks.connections.mockReturnValue({
      activeTabId: 'tab-a',
      tabs: [
        {
          apiBaseUrl: 'http://localhost:3100',
          createdAt: 1,
          id: 'tab-a',
          sessionId: 'session-a',
        },
      ],
    })
    mocks.connectionObservations.mockReturnValue({ observations: [checkingObservation()] })

    const { container } = render(<ConnectionsRoute />)

    expect(screen.getByText('localhost:3100')).toBeTruthy()
    expect(container.querySelector('.rt-revalidate-cue')).not.toBeNull()
    expect(container.querySelector('.rt-revalidate-cue [role="status"]')?.textContent).toContain(
      'updating'
    )
  })

  it('renders Environment admission geometry without a false empty conclusion', () => {
    mocks.connectionObservations.mockReturnValue({ observations: [checkingObservation()] })

    const { container } = render(<EnvironmentRoute />)

    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('No runtime environments observed')).toBeNull()
  })

  it('renders Store Inventory and Inspector admission geometry without empty conclusions', () => {
    mocks.storeData.mockReturnValue({
      canMutate: false,
      inspector: undefined,
      inspectorError: null,
      inventory: undefined,
      inventoryError: null,
      isInspectorLoading: true,
      isInspectorUpdating: false,
      isInventoryLoading: true,
      isInventoryUpdating: false,
      refresh: vi.fn(),
    })

    const inventory = render(<StoreInventoryRoute />)
    expect(inventory.container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('Registry is empty')).toBeNull()
    inventory.unmount()

    const inspector = render(<StoreInspectorRoute />)
    expect(inspector.container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('No Stores registered')).toBeNull()
  })

  it('renders Context Matrix admission geometry without a false empty conclusion', () => {
    mocks.connectionObservations.mockReturnValue({ observations: [checkingObservation()] })
    mocks.environmentObservation.mockReturnValue({
      environments: [],
      error: null,
      isLoading: true,
      projectContexts: [],
    })

    const { container } = render(<ContextMatrixRoute />)

    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('No project contexts observed')).toBeNull()
  })
})
