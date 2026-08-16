/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove ChangeList keeps id-keyed rows physically continuous across reactive removals and reorders.
 * 2. Prove a newer subscription snapshot retires a late local transition commit.
 * 3. Keep only native View Transition edges deterministic while exercising the real local continuity owner.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { SubscriptionState } from '@/lib/use-subscription'
import type { ChangeMeta, ChangeStatus } from '@openspecui/core'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeList } from './change-list'

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: Record<string, string>
    children?: ReactNode
  } & Omit<ComponentProps<'a'>, 'href'>) => {
    const href = Object.entries(params ?? {}).reduce(
      (path, [name, value]) => path.replace(`$${name}`, encodeURIComponent(value)),
      to
    )
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  },
  vtNavController: { activatePop: vi.fn() },
}))

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
    cliTaskSummary: null,
  }
}

const useChangesSubscriptionMock = vi.hoisted(() => vi.fn())
const useOpsxStatusListSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-subscription', () => ({
  useChangesSubscription: useChangesSubscriptionMock,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxStatusListSubscription: useOpsxStatusListSubscriptionMock,
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
})
