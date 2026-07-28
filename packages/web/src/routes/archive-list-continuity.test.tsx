/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove Archive additions and reorders preserve id-keyed row identity.
 * 2. Prove same-order metadata updates avoid local transitions.
 * 3. Prove unsupported or rejected native transitions commit the current snapshot.
 * 4. Prove an empty snapshot waits for its prior rows to retire before showing empty copy.
 * 5. Prove a newer Archive snapshot retires an obsolete transition callback.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { ReactiveProjectionSubscriptionState } from '@/lib/use-subscription'
import type { ArchiveMeta } from '@openspecui/core'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveList } from './archive-list'

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
    params?: Record<string, string>
    state?: unknown
    vt?: unknown
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
}))

const useArchivesSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-subscription', () => ({
  useArchivesSubscription: useArchivesSubscriptionMock,
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

function createArchive(id: string, name: string, updatedAt = 1): ArchiveMeta {
  return {
    id,
    name,
    createdAt: 1,
    updatedAt,
    trackedTaskProgress: {
      tasks: [],
      total: 1,
      completed: 1,
      remaining: 0,
      phase: 'complete',
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

describe('ArchiveList reactive continuity', () => {
  let archiveState: ReactiveProjectionSubscriptionState<ArchiveMeta[]>

  beforeEach(() => {
    archiveState = {
      data: [createArchive('b', 'Archive B')],
      isLoading: false,
      isUpdating: false,
      error: null,
    }
    useArchivesSubscriptionMock.mockImplementation(() => archiveState)
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

  it('adds the newest Archive only when its local transition commits and preserves B identity', async () => {
    let commitTransition: (() => void) | null = null
    const startViewTransition = installNativeTransition((update) => {
      commitTransition = update
      return { finished: new Promise(() => {}) }
    })

    const { container, rerender } = render(<ArchiveList />)
    const rowB = screen.getByRole('link', { name: /Archive B/i })

    archiveState = {
      ...archiveState,
      data: [createArchive('a', 'Archive A', 2), createArchive('b', 'Archive B')],
    }
    rerender(<ArchiveList />)

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('link', { name: /Archive A/i })).toBeNull()
    expect(screen.getByRole('link', { name: /Archive B/i })).toBe(rowB)
    expect(
      container.querySelector<HTMLElement>('[data-archive-list-continuity]')?.style
        .viewTransitionName
    ).toMatch(/^vt-archive-list-/)
    expect(document.documentElement.dataset.vtKind).toBeUndefined()

    if (commitTransition === null) {
      throw new Error('The ArchiveList transition did not expose its production update callback.')
    }
    act(() => commitTransition?.())

    expect(screen.getByRole('link', { name: /Archive A/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Archive B/i })).toBe(rowB)
  })

  it('preserves id-keyed rows across reorder and updates same-order metadata without a transition', async () => {
    archiveState = {
      ...archiveState,
      data: [createArchive('a', 'Archive A'), createArchive('b', 'Archive B')],
    }
    const startViewTransition = installNativeTransition((update) => {
      update()
      return { finished: Promise.resolve() }
    })
    const { rerender } = render(<ArchiveList />)
    const rowA = screen.getByRole('link', { name: /Archive A/i })
    const rowB = screen.getByRole('link', { name: /Archive B/i })

    archiveState = {
      ...archiveState,
      data: [createArchive('b', 'Archive B'), createArchive('a', 'Archive A')],
    }
    rerender(<ArchiveList />)

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: /Archive A/i })).toBe(rowA)
    expect(screen.getByRole('link', { name: /Archive B/i })).toBe(rowB)
    expect(rowA).toHaveAttribute('href', '/archive/a')
    expect(rowB).toHaveAttribute('href', '/archive/b')
    expect(rowA).toHaveAttribute('data-vt-shared', 'vt-archive-a-container')
    expect(rowB).toHaveAttribute('data-vt-shared', 'vt-archive-b-container')

    archiveState = {
      ...archiveState,
      data: [createArchive('b', 'Renamed Archive B'), createArchive('a', 'Archive A')],
    }
    rerender(<ArchiveList />)

    await waitFor(() => expect(screen.getByText('Renamed Archive B')).toBeTruthy())
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /Renamed Archive B/i })).toBe(rowB)
  })

  it('commits an addition immediately when native View Transitions are unavailable', async () => {
    const { rerender } = render(<ArchiveList />)
    const rowB = screen.getByRole('link', { name: /Archive B/i })

    archiveState = {
      ...archiveState,
      data: [createArchive('a', 'Archive A'), createArchive('b', 'Archive B')],
    }
    rerender(<ArchiveList />)

    await waitFor(() => expect(screen.getByRole('link', { name: /Archive A/i })).toBeTruthy())
    expect(screen.getByRole('link', { name: /Archive B/i })).toBe(rowB)
  })

  it('commits an addition immediately when native View Transition startup rejects', async () => {
    const startViewTransition = installNativeTransition(() => {
      throw new Error('native transition rejected')
    })
    const { container, rerender } = render(<ArchiveList />)
    const rowB = screen.getByRole('link', { name: /Archive B/i })

    archiveState = {
      ...archiveState,
      data: [createArchive('a', 'Archive A'), createArchive('b', 'Archive B')],
    }
    rerender(<ArchiveList />)

    await waitFor(() => expect(screen.getByRole('link', { name: /Archive A/i })).toBeTruthy())
    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /Archive B/i })).toBe(rowB)
    expect(
      container.querySelector<HTMLElement>('[data-archive-list-continuity]')?.style
        .viewTransitionName
    ).toBe('')
  })

  it('does not claim the Archive is empty while a local removal transition still displays B', async () => {
    let commitTransition: (() => void) | null = null
    const startViewTransition = installNativeTransition((update) => {
      commitTransition = update
      return { finished: new Promise(() => {}) }
    })
    const { rerender } = render(<ArchiveList />)

    archiveState = {
      ...archiveState,
      data: [],
    }
    rerender(<ArchiveList />)

    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: /Archive B/i })).toBeTruthy()
    expect(screen.queryByText('No archived changes yet.')).toBeNull()

    if (commitTransition === null) {
      throw new Error(
        'The ArchiveList removal transition did not expose its production update callback.'
      )
    }
    act(() => commitTransition?.())

    expect(screen.queryByRole('link', { name: /Archive B/i })).toBeNull()
    expect(screen.getByText('No archived changes yet.')).toBeTruthy()
  })

  it('retires a late Archive transition callback after a newer snapshot commits', async () => {
    let commitObsolete: (() => void) | null = null
    const finishedTransition = { resolve: null as (() => void) | null }
    const transition: TestViewTransition = {
      finished: new Promise<void>((resolve) => {
        finishedTransition.resolve = resolve
      }),
    }
    const startViewTransition = installNativeTransition((update) => {
      commitObsolete = update
      viewTransitionDocument().activeViewTransition = transition
      return transition
    })

    const { rerender } = render(<ArchiveList />)
    archiveState = {
      ...archiveState,
      data: [createArchive('a', 'Archive A'), createArchive('b', 'Archive B')],
    }
    rerender(<ArchiveList />)
    await waitFor(() => expect(startViewTransition).toHaveBeenCalledTimes(1))

    archiveState = {
      ...archiveState,
      data: [createArchive('c', 'Archive C')],
    }
    rerender(<ArchiveList />)
    await waitFor(() => expect(screen.getByRole('link', { name: /Archive C/i })).toBeTruthy())
    expect(startViewTransition).toHaveBeenCalledTimes(1)

    if (commitObsolete === null) {
      throw new Error('The obsolete ArchiveList transition did not expose its update callback.')
    }
    act(() => commitObsolete?.())

    expect(screen.getByRole('link', { name: /Archive C/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Archive A/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Archive B/i })).toBeNull()
    viewTransitionDocument().activeViewTransition = null
    finishedTransition.resolve?.()
  })
})
