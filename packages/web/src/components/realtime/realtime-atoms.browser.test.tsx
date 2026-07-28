/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove realtime visual atoms honor an actual reduced-motion browser preference.
 * 2. Prove realtime inventory/progress atoms remain contained at a 390px component viewport.
 * 3. Preserve accessible status and truthful known/unknown progress in both paths.
 *
 * Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言。"
 * Owner acceptance boundary (2026-07-20): Agents stop at basic component Playwright evidence.
 */
import { cleanup, render } from '@testing-library/react'
import type { CDPSession } from '@vitest/browser-playwright'
import { afterEach, describe, expect, it } from 'vitest'
import { cdp, page } from 'vitest/browser'

import {
  RealtimeProgress,
  RealtimeRevalidateCue,
  RealtimeSettle,
  RealtimeSkeletonInventory,
  RealtimeSkeletonRow,
} from './index'

async function emulateReducedMotion(value: 'no-preference' | 'reduce'): Promise<void> {
  const session = cdp() as CDPSession
  await session.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value }],
  })
}

afterEach(async () => {
  cleanup()
  await emulateReducedMotion('no-preference')
  await page.viewport(1280, 720)
})

describe('realtime visual browser contract', () => {
  it('replaces motion with static visual and accessible equivalents', async () => {
    await emulateReducedMotion('reduce')
    expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)

    const view = render(
      <div>
        <RealtimeSkeletonRow />
        <RealtimeRevalidateCue>
          <span>retained projection</span>
        </RealtimeRevalidateCue>
        <RealtimeSettle>
          <span>settled projection</span>
        </RealtimeSettle>
        <RealtimeProgress progress={{ completed: 2, total: 'unknown' }} />
      </div>
    )

    const skeleton = view.container.querySelector<HTMLElement>('.rt-skeleton')
    const cue = view.container.querySelector<HTMLElement>('.rt-revalidate-cue')
    const settle = view.container.querySelector<HTMLElement>('.rt-settle')
    const progress = view.container.querySelector<HTMLElement>('.rt-progress-indeterminate')

    expect(skeleton).not.toBeNull()
    expect(cue).not.toBeNull()
    expect(settle).not.toBeNull()
    expect(progress).not.toBeNull()
    expect(getComputedStyle(skeleton!, '::after').animationName).toBe('none')
    expect(getComputedStyle(cue!, '::after').animationName).toBe('none')
    expect(getComputedStyle(settle!).animationName).toBe('none')
    expect(getComputedStyle(progress!, '::after').animationName).toBe('none')
    expect(view.container.querySelector('[role="status"]')).toHaveTextContent('updating')
  })

  it('contains list geometry and truthful progress at a mobile component viewport', async () => {
    await page.viewport(390, 844)

    const view = render(
      <section data-testid="mobile-realtime-surface" className="w-full min-w-0 space-y-3">
        <RealtimeSkeletonInventory mode="list-divide" count={4} rowClassName="h-14" />
        <RealtimeProgress progress={{ completed: 3, total: 'unknown' }} />
        <RealtimeProgress progress={{ completed: 1, total: 4 }} />
      </section>
    )

    const surface = view.container.querySelector<HTMLElement>(
      '[data-testid="mobile-realtime-surface"]'
    )
    const determinate = view.container.querySelector<HTMLElement>('.rt-progress-fill')

    expect(surface).not.toBeNull()
    expect(surface!.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth)
    expect(surface!.scrollWidth).toBeLessThanOrEqual(surface!.clientWidth)
    expect(view.container.querySelectorAll('.rt-skeleton-row')).toHaveLength(4)
    expect(view.container.querySelector('.rt-progress-indeterminate')).not.toBeNull()
    expect(determinate?.style.inlineSize).toBe('25%')
  })
})
