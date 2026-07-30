/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the production Stores runtime independently collects every compatible Environment source.
 * 2. Prove non-equivalent settled source evidence preserves one deterministic read projection but revokes mutation.
 * 3. Prove mutation dispatch never observes authority from an uncommitted concurrent render.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
// @vitest-environment jsdom
import type { HostedBackendHealthResponse } from '@openspecui/core/hosted-contract'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { startTransition, Suspense } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionObservation } from './connection-observation'
import type { StoreEnvironmentAuthorityContext } from './store-action-environment-authority'
import { StoresRuntimeProvider, useStoresRuntime } from './stores-runtime'
import type { StoreDataState } from './use-store-data'

const fixtures = vi.hoisted(() => ({
  observations: [] as ConnectionObservation[],
  storeData: new Map<string, StoreDataState>(),
  resolveAuthorityContext: null as (() => StoreEnvironmentAuthorityContext) | null,
}))

vi.mock('./connection-observation', async (importOriginal) => {
  const original = await importOriginal<typeof import('./connection-observation')>()
  return {
    ...original,
    useConnectionObservations: () => ({ revision: 1, observations: fixtures.observations }),
  }
})

vi.mock('./use-store-data', () => ({
  useStoreData: ({ apiBaseUrl }: { apiBaseUrl?: string | null }) =>
    fixtures.storeData.get(apiBaseUrl ?? '') ?? emptyStoreData(),
}))

vi.mock('../components/store-mutation-lifecycle', () => ({
  useStoreMutationLifecycle: () => ({
    locator: null,
    active: [],
    recent: [],
    registerAdmission() {},
  }),
}))

vi.mock('./store-action-environment-authority', () => ({
  useStoreEnvironmentMutationDispatcher: (
    resolveAuthorityContext: () => StoreEnvironmentAuthorityContext
  ) => {
    fixtures.resolveAuthorityContext = resolveAuthorityContext
    return async () => null
  },
}))

vi.mock('./store-environment-selection', () => ({
  useStoreEnvironmentSelection: () => [{ selectedEnvUri: 'env://shared' }, () => {}] as const,
}))

function emptyStoreData(): StoreDataState {
  return {
    inspector: undefined,
    inventory: undefined,
    isInspectorLoading: false,
    isInventoryLoading: false,
    isInspectorUpdating: false,
    isInventoryUpdating: false,
    inventoryError: null,
    inspectorError: null,
    canMutate: false,
    async refresh() {},
  }
}

function settledStoreData(root: string): StoreDataState {
  return {
    ...emptyStoreData(),
    inventory: { available: true, stores: [{ id: 'team', root }] },
    inspector: {
      available: true,
      stores: [{ id: 'team', root, openspec_root: { healthy: true } }],
    },
    canMutate: true,
  }
}

const HEALTH = {
  status: 'ok',
  projectDir: '/work/team',
  projectName: 'team',
  watcherEnabled: true,
  openspecuiVersion: '6.0.1',
  hostedShellProtocolVersion: 1,
  embeddedUiUrl: 'http://127.0.0.1:4100',
  runtimeCapabilities: [],
  cliVersion: '1.6.0',
  envUri: 'env://shared',
  hostedCapabilities: ['stores.inspect', 'stores.mutate', 'stores.content.inspect'],
} satisfies HostedBackendHealthResponse

function observation(
  tabId: string,
  apiBaseUrl: string,
  tabCreatedAt: number
): ConnectionObservation {
  return {
    tabId,
    sessionId: `session-${tabId}`,
    apiBaseUrl,
    tabCreatedAt,
    generation: 1,
    reachability: 'online',
    health: { ...HEALTH, embeddedUiUrl: apiBaseUrl },
    healthError: null,
    rootEvidence: null,
    rootAttempt: {
      tabId,
      sessionId: `session-${tabId}`,
      apiBaseUrl,
      tabCreatedAt,
      generation: 1,
      health: { ...HEALTH, embeddedUiUrl: apiBaseUrl },
      status: 'loading',
      error: null,
      observedAt: 1,
    },
    current: true,
    stale: false,
    observedAt: 1,
  }
}

function RuntimeProbe() {
  const runtime = useStoresRuntime()
  return (
    <output data-testid="runtime">
      {JSON.stringify({
        authority: runtime.authority.kind,
        readSource: runtime.readSource?.tabId ?? null,
        rowRoot: runtime.rows[0]?.root ?? null,
        canPinMutation: runtime.pinMutationAuthority() !== null,
      })}
    </output>
  )
}

const NEVER_SETTLES = new Promise<void>(() => {})

function SuspendingRuntimeProbe({ suspend }: { suspend: boolean }) {
  const runtime = useStoresRuntime()
  if (suspend) throw NEVER_SETTLES
  return <output data-testid="committed-source">{runtime.readSource?.tabId ?? 'none'}</output>
}

afterEach(() => {
  cleanup()
  fixtures.observations = []
  fixtures.storeData.clear()
  fixtures.resolveAuthorityContext = null
})

describe('StoresRuntimeProvider multi-source evidence', () => {
  it('keeps mutation revalidation on the committed observation snapshot while a replacement render suspends', async () => {
    fixtures.observations = [observation('source-a', 'http://127.0.0.1:4100', 1)]
    fixtures.storeData.set('http://127.0.0.1:4100', settledStoreData('/stores/team-a'))
    const view = render(
      <Suspense fallback={<output>pending replacement</output>}>
        <StoresRuntimeProvider enabled>
          <SuspendingRuntimeProbe suspend={false} />
        </StoresRuntimeProvider>
      </Suspense>
    )

    await waitFor(() =>
      expect(view.getByTestId('committed-source').textContent).toBe('source-a')
    )
    expect(fixtures.resolveAuthorityContext?.().observations[0]?.tabId).toBe('source-a')

    fixtures.observations = [observation('source-b', 'http://127.0.0.1:4200', 2)]
    fixtures.storeData.set('http://127.0.0.1:4200', settledStoreData('/stores/team-b'))
    act(() => {
      startTransition(() => {
        view.rerender(
          <Suspense fallback={<output>pending replacement</output>}>
            <StoresRuntimeProvider enabled>
              <SuspendingRuntimeProbe suspend />
            </StoresRuntimeProvider>
          </Suspense>
        )
      })
    })

    expect(view.getByTestId('committed-source').textContent).toBe('source-a')
    expect(fixtures.resolveAuthorityContext?.().observations[0]?.tabId).toBe('source-a')
  })

  it('keeps deterministic read evidence but revokes mutation when settled sources disagree', async () => {
    fixtures.observations = [
      observation('source-a', 'http://127.0.0.1:4100', 1),
      observation('source-b', 'http://127.0.0.1:4200', 2),
    ]
    fixtures.storeData.set('http://127.0.0.1:4100', settledStoreData('/stores/team-a'))
    fixtures.storeData.set('http://127.0.0.1:4200', settledStoreData('/stores/team-b'))

    const view = render(
      <StoresRuntimeProvider enabled>
        <RuntimeProbe />
      </StoresRuntimeProvider>
    )

    await waitFor(() => {
      expect(JSON.parse(view.getByTestId('runtime').textContent ?? '{}')).toEqual({
        authority: 'conflict',
        readSource: 'source-a',
        rowRoot: '/stores/team-a',
        canPinMutation: false,
      })
    })
  })
})
