import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { waitForPrepareTask } from './prepare-wait'

describe('waitForPrepareTask', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    document.getElementById('vt-ready-indicator-style')?.remove()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
    document.getElementById('vt-ready-indicator-style')?.remove()
  })

  it('allows escape to cancel pre-VT preparation and removes the wait indicator', async () => {
    const pending = waitForPrepareTask(() => new Promise<never>(() => {}), {
      timeoutMs: 0,
      indicatorDelayMs: 0,
    })

    await vi.advanceTimersByTimeAsync(0)
    expect(document.querySelector('[data-vt-ready-indicator]')).not.toBeNull()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    await expect(pending).resolves.toEqual({ status: 'cancelled' })
    expect(document.querySelector('[data-vt-ready-indicator]')).toBeNull()
  })
})
