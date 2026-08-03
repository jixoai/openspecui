/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Prove presentation copy exposes only reducer-authorized Guide controls.
 * 2. Keep terminal and unresolved-stage labels independent from Base UI rendering details.
 *
 * Original request (2026-08-02): replace Driver.js with a headless framework and retain typed Guide authority.
 */
import { describe, expect, it, vi } from 'vitest'
import {
  getConfigGuidePresentationCopy,
  type ConfigGuidePresentation,
} from './config-guide-presentation'

function presentation(overrides: Partial<ConfigGuidePresentation>): ConfigGuidePresentation {
  return {
    kind: 'stage',
    label: 'Active Root',
    canGoBack: true,
    reducedMotion: false,
    onCancel: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
    ...overrides,
  }
}

describe('getConfigGuidePresentationCopy', () => {
  it('hides Continue while a stage remains unresolved', () => {
    expect(
      getConfigGuidePresentationCopy(
        presentation({
          signal: {
            status: 'warning',
            title: 'Review warning',
            detail: 'The current projection retains a warning.',
          },
        })
      )
    ).toEqual({
      description: 'The current projection retains a warning.',
      nextLabel: 'Continue',
      showNext: false,
    })
  })

  it('exposes only the typed terminal action label', () => {
    expect(getConfigGuidePresentationCopy(presentation({ kind: 'target-failed' }))).toEqual({
      description: 'The semantic Guide target did not mount. Retry after the route is available.',
      nextLabel: 'Retry',
      showNext: true,
    })
    expect(getConfigGuidePresentationCopy(presentation({ kind: 'complete' }))).toEqual({
      description: 'Resolved Context is current and the selected Root is usable.',
      nextLabel: 'Done',
      showNext: true,
    })
  })
})
