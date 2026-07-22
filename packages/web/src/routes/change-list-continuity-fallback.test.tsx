/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove ChangeList immediately commits a reactive snapshot when native View Transitions are unavailable.
 * 2. Preserve id-keyed DOM identity through the real local continuity helper and runtime fallback.
 *
 * Original request (2026-07-23): "List mutations and route changes preserve physical continuity through existing motion/View Transition patterns."
 */
import type { SubscriptionState } from '@/lib/use-subscription'
import type { ChangeMeta, ChangeStatus } from '@openspecui/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangeList } from './change-list'

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
      source: { kind: 'none', artifactId: null, outputPath: null, filePaths: [] },
    },
    documentChecklistSummary: { groups: [], total: 0, completed: 0, remaining: 0 },
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

describe('ChangeList native View Transition fallback', () => {
  let changesState: SubscriptionState<ChangeMeta[]>
  const statusState: SubscriptionState<ChangeStatus[]> = {
    data: [],
    isLoading: false,
    error: null,
  }

  beforeEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition')
    changesState = {
      data: [createChange('a', 'Change A'), createChange('b', 'Change B')],
      isLoading: false,
      error: null,
    }
    useChangesSubscriptionMock.mockImplementation(() => changesState)
    useOpsxStatusListSubscriptionMock.mockImplementation(() => statusState)
  })

  afterEach(() => cleanup())

  it('commits the current snapshot immediately without an invented animation state', async () => {
    const { rerender } = render(<ChangeList />)
    const rowB = screen.getByRole('link', { name: /Change B/i })

    changesState = {
      data: [createChange('b', 'Change B')],
      isLoading: false,
      error: null,
    }
    rerender(<ChangeList />)

    await waitFor(() => expect(screen.queryByRole('link', { name: /Change A/i })).toBeNull())
    expect(screen.getByRole('link', { name: /Change B/i })).toBe(rowB)
  })
})
