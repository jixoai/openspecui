/**
 * Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
 * 1. Prove Owned and Referenced Catalog rows preserve compound identity across reactive mutations.
 * 2. Prove a scope switch retires an earlier local transition before it can restore old rows.
 * 3. Prove local native-transition fallback commits the current Catalog without fake state.
 * 4. Prove StrictMode and native-startup failure preserve current Catalog truth.
 * 5. Stabilize only navigation rendering while exercising the real SpecList-local continuity owner.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { SubscriptionState } from '@/lib/use-subscription'
import type {
  SpecCatalog,
  SpecCatalogEntry,
  SpecCatalogReferenceSource,
} from '@openspecui/core/spec-catalog'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, type ComponentProps, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SpecList } from './spec-list'

const { locationState, useSpecsSubscriptionMock } = vi.hoisted(() => ({
  locationState: { current: null as Record<string, unknown> | null },
  useSpecsSubscriptionMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => ({ state: locationState.current }),
}))

vi.mock('@/lib/use-subscription', () => ({
  useSpecsSubscription: useSpecsSubscriptionMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    params,
    state: _state,
    vt: _vt,
    children,
    ...props
  }: {
    to: string
    params: Record<string, string>
    state?: unknown
    vt?: unknown
    children?: ReactNode
  } & Omit<ComponentProps<'a'>, 'href'>) => {
    const href = Object.entries(params).reduce(
      (path, [name, value]) => path.replace(`$${name}`, encodeURIComponent(value)),
      to
    )
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
}))

interface TestViewTransition {
  finished: Promise<void>
}

type TestViewTransitionDocument = Document & {
  activeViewTransition?: TestViewTransition | null
  startViewTransition?: (update: () => void) => TestViewTransition
}

function viewTransitionDocument(): TestViewTransitionDocument {
  return document as TestViewTransitionDocument
}

function installNativeTransition(onStart: (update: () => void) => TestViewTransition) {
  const startViewTransition = vi.fn(onStart)
  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: startViewTransition,
  })
  return startViewTransition
}

function createOwned(specId: string, name: string): SpecCatalogEntry {
  return {
    identity: { kind: 'owned', specId },
    source: 'owned',
    readOnly: false,
    name,
    summary: null,
    updatedAt: 1,
  }
}

function createReferenced(storeId: string, specId: string, name: string): SpecCatalogEntry {
  return {
    identity: { kind: 'referenced', storeId, specId },
    source: 'referenced',
    readOnly: true,
    name,
    summary: null,
    requirementCount: 1,
    updatedAt: 0,
  }
}

function createReferenceSource(storeId: string): SpecCatalogReferenceSource {
  return {
    storeId,
    provenance: 'live',
    state: 'ready',
    diagnostics: [],
    evidence: {
      success: true,
      stdout: '{}',
      stderr: '',
      exitCode: 0,
      diagnostics: [],
    },
  }
}

function createCatalog(entries: SpecCatalogEntry[], stores: string[] = []): SpecCatalog {
  return {
    entries,
    referenceSources: stores.map(createReferenceSource),
    observedAt: 1,
  }
}

describe('SpecList reactive continuity', () => {
  let catalogState: SubscriptionState<SpecCatalog>

  beforeEach(() => {
    locationState.current = null
    catalogState = {
      data: createCatalog([createOwned('a', 'Owned A'), createOwned('b', 'Owned B')]),
      isLoading: false,
      error: null,
    }
    useSpecsSubscriptionMock.mockImplementation(() => catalogState)
    Reflect.deleteProperty(document, 'startViewTransition')
    Reflect.deleteProperty(document, 'activeViewTransition')
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    Reflect.deleteProperty(document, 'startViewTransition')
    Reflect.deleteProperty(document, 'activeViewTransition')
  })

  it('keeps Owned B identity while [A, B] -> [B] waits for the local transition commit', async () => {
    let commitTransition: (() => void) | null = null
    const finished = { resolve: null as (() => void) | null }
    const startViewTransition = installNativeTransition((update) => {
      commitTransition = update
      return {
        finished: new Promise<void>((resolve) => {
          finished.resolve = resolve
        }),
      }
    })
    const { rerender } = render(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )
    const rowB = screen.getByRole('link', { name: /Owned B/i })

    catalogState = {
      ...catalogState,
      data: createCatalog([createOwned('b', 'Owned B')]),
    }
    rerender(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: /Owned B/i })).toBe(rowB)
    expect(screen.getByRole('link', { name: /Owned A/i })).toBeTruthy()
    expect(rowB).toHaveAttribute('href', '/specs/owned/b')

    if (commitTransition === null) {
      throw new Error(
        'The Owned SpecList transition did not expose its production update callback.'
      )
    }
    act(() => commitTransition?.())

    expect(screen.getByRole('link', { name: /Owned B/i })).toBe(rowB)
    expect(screen.queryByRole('link', { name: /Owned A/i })).toBeNull()
    finished.resolve?.()
  })

  it('keeps same-Store Referenced compound rows through reorder and same-order metadata updates', async () => {
    locationState.current = { __specListScope: 'referenced' }
    catalogState = {
      data: createCatalog(
        [
          createReferenced('store-a', 'a', 'Referenced A'),
          createReferenced('store-a', 'b', 'Referenced B'),
          createReferenced('store-b', 'a', 'Other Store A'),
        ],
        ['store-a', 'store-b']
      ),
      isLoading: false,
      error: null,
    }
    const startViewTransition = installNativeTransition((update) => {
      update()
      return { finished: Promise.resolve() }
    })
    const { rerender } = render(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )
    const rowA = screen.getByRole('link', { name: /Referenced A/i })
    const rowB = screen.getByRole('link', { name: /Referenced B/i })
    const otherStoreA = screen.getByRole('link', { name: /Other Store A/i })

    catalogState = {
      ...catalogState,
      data: createCatalog(
        [
          createReferenced('store-a', 'b', 'Referenced B'),
          createReferenced('store-a', 'a', 'Referenced A'),
          createReferenced('store-b', 'a', 'Other Store A'),
        ],
        ['store-a', 'store-b']
      ),
    }
    rerender(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: /Referenced A/i })).toBe(rowA)
    expect(screen.getByRole('link', { name: /Referenced B/i })).toBe(rowB)
    expect(screen.getByRole('link', { name: /Other Store A/i })).toBe(otherStoreA)
    expect(rowA).toHaveAttribute('href', '/specs/referenced/store-a/a')
    expect(otherStoreA).toHaveAttribute('href', '/specs/referenced/store-b/a')
    expect(rowA).toHaveAttribute('data-vt-shared', 'vt-specs-referenced-store-a-a-container')
    expect(otherStoreA).toHaveAttribute('data-vt-shared', 'vt-specs-referenced-store-b-a-container')

    catalogState = {
      ...catalogState,
      data: createCatalog(
        [
          createReferenced('store-a', 'b', 'Renamed Referenced B'),
          createReferenced('store-a', 'a', 'Referenced A'),
          createReferenced('store-b', 'a', 'Other Store A'),
        ],
        ['store-a', 'store-b']
      ),
    }
    rerender(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )

    await waitFor(() => expect(screen.getByText('Renamed Referenced B')).toBeTruthy())
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /Renamed Referenced B/i })).toBe(rowB)
  })

  it('retires a late Owned transition when a newer Owned Catalog snapshot has committed', async () => {
    let commitObsolete: (() => void) | null = null
    const finished = { resolve: null as (() => void) | null }
    const transition: TestViewTransition = {
      finished: new Promise<void>((resolve) => {
        finished.resolve = resolve
      }),
    }
    const startViewTransition = installNativeTransition((update) => {
      commitObsolete = update
      viewTransitionDocument().activeViewTransition = transition
      return transition
    })
    const { rerender } = render(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )

    catalogState = {
      ...catalogState,
      data: createCatalog([createOwned('b', 'Owned B')]),
    }
    rerender(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))

    catalogState = {
      ...catalogState,
      data: createCatalog([createOwned('c', 'Owned C')]),
    }
    rerender(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )
    await waitFor(() => expect(screen.getByRole('link', { name: /Owned C/i })).toBeTruthy())

    if (commitObsolete === null) {
      throw new Error(
        'The obsolete Owned transition did not expose its production update callback.'
      )
    }
    act(() => commitObsolete?.())

    expect(screen.getByRole('link', { name: /Owned C/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Owned A/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Owned B/i })).toBeNull()
    viewTransitionDocument().activeViewTransition = null
    finished.resolve?.()
  })

  it('retires a pending Owned transition immediately when the user switches to Referenced', async () => {
    let commitOwned: (() => void) | null = null
    const transition: TestViewTransition = { finished: new Promise(() => {}) }
    const startViewTransition = installNativeTransition((update) => {
      commitOwned = update
      viewTransitionDocument().activeViewTransition = transition
      return transition
    })
    const { rerender } = render(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )

    catalogState = {
      ...catalogState,
      data: createCatalog(
        [
          createOwned('a', 'Owned A'),
          createReferenced('store-a', 'reference', 'Referenced Current'),
        ],
        ['store-a']
      ),
    }
    rerender(
      <StrictMode>
        <SpecList />
      </StrictMode>
    )
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('tab', { name: 'Referenced 1' }))
    expect(screen.getByRole('link', { name: /Referenced Current/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Owned A/i })).toBeNull()

    if (commitOwned === null) {
      throw new Error('The pending Owned transition did not expose its production update callback.')
    }
    act(() => commitOwned?.())

    expect(screen.getByRole('link', { name: /Referenced Current/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Owned A/i })).toBeNull()
    viewTransitionDocument().activeViewTransition = null
  })

  it('commits the current Catalog immediately when native View Transitions are unavailable', async () => {
    const { rerender } = render(<SpecList />)
    const rowB = screen.getByRole('link', { name: /Owned B/i })

    catalogState = {
      ...catalogState,
      data: createCatalog([createOwned('b', 'Owned B')]),
    }
    rerender(<SpecList />)

    await waitFor(() => expect(screen.queryByRole('link', { name: /Owned A/i })).toBeNull())
    expect(screen.getByRole('link', { name: /Owned B/i })).toBe(rowB)
  })

  it('commits the current Catalog immediately when native View Transition startup throws', async () => {
    const startViewTransition = installNativeTransition(() => {
      throw new Error('native transition rejected')
    })
    const { rerender } = render(<SpecList />)
    const rowB = screen.getByRole('link', { name: /Owned B/i })

    catalogState = {
      ...catalogState,
      data: createCatalog([createOwned('b', 'Owned B')]),
    }
    rerender(<SpecList />)

    await waitFor(() => expect(screen.queryByRole('link', { name: /Owned A/i })).toBeNull())
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /Owned B/i })).toBe(rowB)
  })
})
