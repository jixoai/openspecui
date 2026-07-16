/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify Archive copy and rows stay scoped to the writable Planning root projection.
 * 2. Verify the Planning-root empty state does not imply environment-wide completeness.
 *
 * Original request (2026-07-15): "One project backend has one launch project and one CLI-selected writable planning root."
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArchiveList } from './archive-list'

const useArchivesSubscriptionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/use-subscription', () => ({
  useArchivesSubscription: useArchivesSubscriptionMock,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    params,
    children,
    ...props
  }: {
    to: string
    params?: { changeId?: string }
    children?: ReactNode
  } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to.replace('$changeId', params?.changeId ?? '')} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
}))

describe('ArchiveList', () => {
  beforeEach(() => {
    useArchivesSubscriptionMock.mockReset()
  })

  afterEach(() => cleanup())

  it('renders only rows supplied by the writable Planning-root subscription', async () => {
    useArchivesSubscriptionMock.mockReturnValue({
      data: [
        {
          id: '2026-07-16-planning-only',
          name: 'Planning-only archive',
          trackedTaskProgress: { total: 1, completed: 1, phase: 'complete' },
          documentChecklistSummary: { total: 1, completed: 1, groups: [] },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      isLoading: false,
      error: null,
    })

    render(<ArchiveList />)

    await waitFor(() => expect(screen.getByText('Planning-only archive')).toBeTruthy())
    expect(screen.getByText(/current writable Planning root/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /Planning-only archive/i }).getAttribute('href')).toBe(
      '/archive/2026-07-16-planning-only'
    )
  })

  it('attributes an empty list to this Planning root', async () => {
    useArchivesSubscriptionMock.mockReturnValue({ data: [], isLoading: false, error: null })

    render(<ArchiveList />)

    await waitFor(() => expect(screen.getByText('No archived changes yet.')).toBeTruthy())
    expect(screen.getByText(/Changes in this Planning root are archived/i)).toBeTruthy()
  })
})
