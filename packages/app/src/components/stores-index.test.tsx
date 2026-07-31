/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove the Stores index renders searchable/filterable rows with composite-identity Detail links (7.3).
 * 2. Prove observed-only completeness language and no horizontal-overflow container class (7.17).
 * 3. Prove retained and empty Store projections use the shared realtime revalidation cue.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Owner-reported defect (2026-07-31): Store removal must visibly retain and refresh the list.
 */
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StoresIndex, type StoreIndexRow } from './stores-index'

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

const ROWS: readonly StoreIndexRow[] = [
  {
    storeId: 'team',
    root: '/stores/team',
    health: 'healthy',
    usage: { rootFor: 2, referencedBy: 1 },
    mutationState: 'idle',
  },
  { storeId: 'design', root: '/stores/design', health: 'unhealthy', mutationState: 'failed' },
  { storeId: 'legacy', health: 'unknown', mutationState: 'idle' },
]

describe('StoresIndex (7.3/7.17)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders every Store row and observed-only completeness language', async () => {
    await renderAt(<StoresIndex rows={ROWS} envUri="env://1" />)
    expect(screen.getByText('team')).toBeTruthy()
    expect(screen.getByText('design')).toBeTruthy()
    expect(screen.getByText('legacy')).toBeTruthy()
    expect(screen.getByText(/Observed stores only/)).toBeTruthy()
  })

  it('opens a composite-identity Store Detail path (envUri + storeId) on row click', async () => {
    const onOpenDetail = vi.fn()
    await renderAt(<StoresIndex rows={ROWS} envUri="env://1" onOpenDetail={onOpenDetail} />)
    fireEvent.click(screen.getByLabelText('Open store team'))
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
    const path = onOpenDetail.mock.calls[0]![0] as string
    expect(path.startsWith('/stores/')).toBe(true)
    expect(path).toContain('team')
    // The opaque envUri is encoded as a single segment.
    expect(path.split('/').filter(Boolean)).toHaveLength(3)
  })

  it('filters rows by search query', async () => {
    await renderAt(<StoresIndex rows={ROWS} envUri="env://1" />)
    fireEvent.change(screen.getByLabelText('Search stores'), { target: { value: 'team' } })
    expect(screen.getByText('team')).toBeTruthy()
    expect(screen.queryByText('design')).toBeNull()
    expect(screen.queryByText('legacy')).toBeNull()
  })

  it('filters rows by health', async () => {
    await renderAt(<StoresIndex rows={ROWS} envUri="env://1" />)
    fireEvent.change(screen.getByLabelText('Filter stores by health'), {
      target: { value: 'unhealthy' },
    })
    expect(screen.queryByText('team')).toBeNull()
    expect(screen.getByText('design')).toBeTruthy()
  })

  it('shows direct mutation state on a failed row', async () => {
    await renderAt(<StoresIndex rows={ROWS} envUri="env://1" />)
    expect(screen.getByText('mutation failed')).toBeTruthy()
  })

  it('uses a container-responsive root with no horizontal-scroll affordance', async () => {
    const { container } = await renderAt(<StoresIndex rows={ROWS} envUri="env://1" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('@container')
    // The index must not use an overflow-x-auto / horizontal-scroll class.
    expect(root.className).not.toContain('overflow-x-auto')
  })

  it('renders an empty observed state without claiming machine-wide completeness', async () => {
    await renderAt(<StoresIndex rows={[]} envUri="env://1" />)
    expect(screen.getByText(/No stores observed in this environment/)).toBeTruthy()
  })

  it('retains Store rows under the shared revalidation cue while updating', async () => {
    const { container } = await renderAt(<StoresIndex rows={ROWS} envUri="env://1" isUpdating />)
    const cue = container.querySelector('.rt-revalidate-cue')
    expect(cue).not.toBeNull()
    expect(cue?.getAttribute('aria-busy')).toBe('true')
    expect(screen.getByText('Stores updating')).toBeTruthy()
    expect(screen.getByText('team')).toBeTruthy()
    expect(screen.getByText('design')).toBeTruthy()
  })

  it('keeps the shared revalidation cue visible for an updating empty projection', async () => {
    const { container } = await renderAt(<StoresIndex rows={[]} envUri="env://1" isUpdating />)
    expect(container.querySelector('.rt-revalidate-cue')).not.toBeNull()
    expect(screen.getByText(/No stores observed in this environment/)).toBeTruthy()
  })
})
