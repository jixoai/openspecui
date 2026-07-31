/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Stores index keeps its direct evidence inside crowded, intermediate, and spacious containers.
 * 2. Prove Store cleanup commands remain distinct while readonly content regions settle independently.
 * 3. Keep this Chromium fixture below the owner-only final App walkthrough boundary.
 *
 * Original request (2026-07-30): "我应该如何展示Stores这个界面如果是一个列表，那么StoreDetailPage应该如何设计呢？"
 */
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import '../index.css'
import { selectStoreDetailProjection } from '../lib/store-detail-projection'
import { StoreDetail } from './store-detail'
import { StoresIndex } from './stores-index'

beforeEach(async () => {
  await page.viewport(320, 720)
})

afterEach(() => cleanup())

describe('Stores browser boundary', () => {
  it.each([320, 640, 1024])(
    'keeps index rows readable at %ipx without exposing a horizontal page scroll owner',
    async (width) => {
      await page.viewport(width, 720)
      const view = render(
        <main className="w-full min-w-0 overflow-hidden">
          <StoresIndex
            envUri="openspecui-env://1/a-long-opaque-environment-identity"
            environmentLabel="Local Environment"
            rows={[
              {
                storeId: 'design-system',
                root: '/Users/example/a/very/long/path/to/design-system',
                health: 'healthy',
                usage: { rootFor: 1, referencedBy: 3 },
                mutationState: 'idle',
              },
            ]}
          />
        </main>
      )

      expect(screen.getByText('design-system')).toBeVisible()
      expect(screen.getByText(/Root for 1/)).toBeVisible()
      expect(view.container.scrollWidth).toBeLessThanOrEqual(view.container.clientWidth)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
    }
  )

  it('keeps Detail evidence and distinct unregister/remove commands contained', () => {
    const projection = selectStoreDetailProjection({
      identity: { envUri: 'openspecui-env://1/opaque', storeId: 'design-system' },
      health: 'healthy',
      usage: [{ kind: 'referenced-by', sourceId: 'workspace-a', label: 'acme/product' }],
      specs: { state: 'ready', entries: [{ id: 'tokens', requirementCount: 4 }] },
      changes: { state: 'error', error: 'Changes projection failed.' },
      mutation: 'idle',
      repository: { root: '/Users/example/stores/design-system' },
      hasAuthority: true,
    })
    const view = render(
      <main className="w-full min-w-0 overflow-hidden">
        <StoreDetail projection={projection} onUnregister={() => {}} onRemove={() => {}} />
      </main>
    )

    expect(screen.getByText('tokens')).toBeVisible()
    expect(screen.getByText('Changes projection failed.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Unregister store' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Remove store files' })).toBeVisible()
    expect(view.container.scrollWidth).toBeLessThanOrEqual(view.container.clientWidth)
  })
})
