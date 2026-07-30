/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Store Detail renders the direct plane (identity/health/Usage/content) (7.8/7.9/7.10).
 * 2. Prove blocking diagnostics promote and Specs/Changes render independently (7.10/7.11).
 * 3. Prove destructive remove is gated by authority + lifecycle + confirmation (7.12).
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
// @vitest-environment jsdom
import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  selectStoreDetailProjection,
  type StoreDetailProjectionInput,
} from '../lib/store-detail-projection'
import { StoreDetail } from './store-detail'

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

function projection(
  overrides: Partial<StoreDetailProjectionInput> = {}
): StoreDetailProjectionInput['identity'] extends never
  ? never
  : ReturnType<typeof selectStoreDetailProjection> {
  return selectStoreDetailProjection({
    identity: { envUri: 'env://1', storeId: 'team' },
    health: 'healthy',
    usage: [],
    specs: { state: 'loading' },
    changes: { state: 'loading' },
    mutation: 'idle',
    repository: {},
    hasAuthority: true,
    ...overrides,
  })
}

describe('StoreDetail (7.8-7.13)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders the direct plane: Store id, health, envUri', async () => {
    await renderAt(<StoreDetail projection={projection()} />)
    expect(screen.getByText('team')).toBeTruthy()
    expect(screen.getByText('env://1')).toBeTruthy()
    expect(screen.getByText('healthy')).toBeTruthy()
  })

  it('promotes blocking diagnostics to the direct plane', async () => {
    await renderAt(
      <StoreDetail
        projection={projection({
          blockingDiagnostics: [{ severity: 'error', message: 'root unhealthy' }],
        })}
      />
    )
    expect(screen.getByText('root unhealthy')).toBeTruthy()
  })

  it('renders observed-only Usage honestly', async () => {
    await renderAt(<StoreDetail projection={projection()} />)
    expect(screen.getByText('No reference currently observed.')).toBeTruthy()
  })

  it('renders Specs and Changes content regions independently', async () => {
    await renderAt(
      <StoreDetail
        projection={projection({
          specs: { state: 'error', error: 'specs failed' },
          changes: { state: 'ready', entries: [] },
        })}
      />
    )
    expect(screen.getByText('specs failed')).toBeTruthy()
    // Changes region is ready (not error), proving independence.
    expect(screen.getByText('Active Changes')).toBeTruthy()
  })

  it('renders readonly Specs entries with requirement counts', async () => {
    await renderAt(
      <StoreDetail
        projection={projection({
          specs: { state: 'ready', entries: [{ id: 'auth', requirementCount: 3 }] },
          changes: { state: 'empty' },
        })}
      />
    )
    expect(screen.getByText('auth')).toBeTruthy()
    expect(screen.getByText('3 requirements')).toBeTruthy()
  })

  it('gates destructive remove on authority and lifecycle', async () => {
    const { container } = await renderAt(
      <div>
        <StoreDetail projection={projection({ hasAuthority: false })} onRemove={() => {}} />
      </div>
    )
    expect(container.textContent).toContain('Remove requires current Environment authority')
    expect(screen.queryByText('Remove store')).toBeNull()
  })

  it('requires confirmation before removing a Store', async () => {
    const onRemove = vi.fn()
    await renderAt(<StoreDetail projection={projection()} onRemove={onRemove} />)
    fireEvent.click(screen.getByText('Remove store'))
    expect(screen.getByText(/Unregister and remove/)).toBeTruthy()
    expect(onRemove).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Confirm remove'))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})
