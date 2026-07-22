/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove ChangeList keeps id-keyed rows physically continuous across reactive removals and reorders.
 * 2. Prove a retained Change row reaches the real VTLink/navigation owner with its exact handoff.
 * 3. Keep transport and native-runtime edges deterministic without replacing ChangeList or VTLink.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { SubscriptionState } from '@/lib/use-subscription'
import type { ChangeMeta, ChangeStatus } from '@openspecui/core'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { forwardRef, type ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeList } from './change-list'

interface TestRouterLinkProps extends Omit<ComponentProps<'a'>, 'href'> {
  to: string
  params?: Record<string, string>
  replace?: boolean
  state?: unknown
  viewTransition?: boolean
}

function createChange(id: string, name: string): ChangeMeta {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt: 1,
    trackedTaskProgress: {
      tasks: [],
      total: 1,
      completed: 0,
      remaining: 1,
      phase: 'in-progress',
      source: {
        kind: 'none',
        artifactId: null,
        outputPath: null,
        filePaths: [],
      },
    },
    documentChecklistSummary: {
      groups: [],
      total: 0,
      completed: 0,
      remaining: 0,
    },
  }
}

const useChangesSubscriptionMock = vi.hoisted(() => vi.fn())
const useOpsxStatusListSubscriptionMock = vi.hoisted(() => vi.fn())
const navigateMock = vi.hoisted(() => vi.fn())
const prepareRouteDetailViewTransitionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-subscription', () => ({
  useChangesSubscription: useChangesSubscriptionMock,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusListSubscription: useOpsxStatusListSubscriptionMock,
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: {
    getAreaForPath: () => 'main',
    getLocation: () => ({ pathname: '/changes' }),
    push: vi.fn(),
    replace: vi.fn(),
    activatePop: vi.fn(),
  },
}))

vi.mock('@/lib/view-transitions/detail-prepare', () => ({
  prepareRouteDetailViewTransition: prepareRouteDetailViewTransitionMock,
}))

vi.mock('@tanstack/react-router', () => ({
  Link: forwardRef<HTMLAnchorElement, TestRouterLinkProps>(function TestRouterLink(
    { to, params, replace: _replace, state: _state, viewTransition: _viewTransition, ...props },
    ref
  ) {
    const href = Object.entries(params ?? {}).reduce(
      (path, [name, value]) => path.replace(`$${name}`, encodeURIComponent(value)),
      to
    )
    return <a ref={ref} href={href} {...props} />
  }),
  useLocation: () => ({ pathname: '/changes' }),
  useNavigate: () => navigateMock,
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

describe('ChangeList reactive continuity', () => {
  let changesState: SubscriptionState<ChangeMeta[]>
  const statusState: SubscriptionState<ChangeStatus[]> = {
    data: [],
    isLoading: false,
    error: null,
  }

  beforeEach(() => {
    changesState = {
      data: [createChange('a', 'Change A'), createChange('b', 'Change B')],
      isLoading: false,
      error: null,
    }
    useChangesSubscriptionMock.mockImplementation(() => changesState)
    useOpsxStatusListSubscriptionMock.mockImplementation(() => statusState)
    prepareRouteDetailViewTransitionMock.mockResolvedValue('ready')
    Reflect.deleteProperty(document, 'startViewTransition')
    Reflect.deleteProperty(document, 'activeViewTransition')
    delete document.documentElement.dataset.vtKind
    delete document.documentElement.dataset.vtArea
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    Reflect.deleteProperty(document, 'startViewTransition')
    Reflect.deleteProperty(document, 'activeViewTransition')
  })

  it('retains the removed row until the local View Transition commits while preserving B identity', async () => {
    let commitTransition: (() => void) | null = null
    const startViewTransition = installNativeTransition((update) => {
      commitTransition = update
      return { finished: new Promise(() => {}) }
    })

    const { container, rerender } = render(<ChangeList />)
    const rowB = screen.getByRole('link', { name: /Change B/i })

    changesState = {
      data: [createChange('b', 'Change B')],
      isLoading: false,
      error: null,
    }
    rerender(<ChangeList />)

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: /Change A/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Change B/i })).toBe(rowB)
    expect(
      container.querySelector<HTMLElement>('[data-change-list-continuity]')?.style
        .viewTransitionName
    ).toMatch(/^vt-change-list-/)
    expect(document.documentElement.dataset.vtKind).toBeUndefined()

    if (commitTransition === null) {
      throw new Error(
        'The local ChangeList transition did not expose its production update callback.'
      )
    }
    act(() => commitTransition?.())

    expect(screen.queryByRole('link', { name: /Change A/i })).toBeNull()
    expect(screen.getByRole('link', { name: /Change B/i })).toBe(rowB)
  })

  it('keeps both id-keyed row nodes and route identity across a reactive reorder', async () => {
    const startViewTransition = installNativeTransition((update) => {
      update()
      return { finished: Promise.resolve() }
    })
    const { rerender } = render(<ChangeList />)
    const rowA = screen.getByRole('link', { name: /Change A/i })
    const rowB = screen.getByRole('link', { name: /Change B/i })

    changesState = {
      data: [createChange('b', 'Change B'), createChange('a', 'Change A')],
      isLoading: false,
      error: null,
    }
    rerender(<ChangeList />)

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: /Change A/i })).toBe(rowA)
    expect(screen.getByRole('link', { name: /Change B/i })).toBe(rowB)
    expect(rowA).toHaveAttribute('href', '/changes/a')
    expect(rowB).toHaveAttribute('href', '/changes/b')
    expect(rowA).toHaveAttribute('data-vt-shared', 'vt-changes-a-container')
    expect(rowB).toHaveAttribute('data-vt-shared', 'vt-changes-b-container')
  })

  it('retires a late A transition commit when a newer snapshot has already committed', async () => {
    let commitA: (() => void) | null = null
    const finishedTransition = { resolve: null as (() => void) | null }
    const transition: TestViewTransition = {
      finished: new Promise<void>((resolve) => {
        finishedTransition.resolve = () => resolve()
      }),
    }
    const startViewTransition = installNativeTransition((update) => {
      commitA = update
      viewTransitionDocument().activeViewTransition = transition
      return transition
    })

    const { rerender } = render(<ChangeList />)
    changesState = {
      data: [createChange('b', 'Change B')],
      isLoading: false,
      error: null,
    }
    rerender(<ChangeList />)
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))

    changesState = {
      data: [createChange('c', 'Change C')],
      isLoading: false,
      error: null,
    }
    rerender(<ChangeList />)
    await waitFor(() => expect(screen.getByRole('link', { name: /Change C/i })).toBeTruthy())
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /Change C/i })).toBeTruthy()

    if (commitA === null) {
      throw new Error('The initial ChangeList transition did not expose its update callback.')
    }
    act(() => commitA?.())

    expect(screen.getByRole('link', { name: /Change C/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Change B/i })).toBeNull()
    viewTransitionDocument().activeViewTransition = null
    finishedTransition.resolve?.()
  })

  it('keeps the real VTLink handoff and issues one detail navigation for B', async () => {
    render(<ChangeList />)
    const rowB = screen.getByRole('link', { name: /Change B/i })

    fireEvent.click(rowB)

    await waitFor(() => expect(navigateMock).toHaveBeenCalledTimes(1))
    expect(prepareRouteDetailViewTransitionMock).toHaveBeenCalledWith({
      intent: {
        area: 'main',
        kind: 'route-detail',
        direction: 'forward',
      },
      pathname: '/changes/b',
      search: '',
      state: expect.any(Function),
    })
    const navigateRequest = navigateMock.mock.calls[0]?.[0]
    if (navigateRequest === undefined || typeof navigateRequest.state !== 'function') {
      throw new Error('VTLink did not submit a Router navigation state updater.')
    }
    expect(navigateRequest.href).toBe('/changes/b')
    expect(navigateRequest.state({})).toMatchObject({
      __vtHandoff: {
        family: 'changes',
        entityId: 'b',
        title: 'Change B',
        subtitle: 'b',
      },
    })
  })
})
