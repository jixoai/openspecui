/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Exercise the Provider-to-presentation-adapter contract against a real Chromium DOM.
 * 2. Prove desktop and narrow Config Guide targets remain present without horizontal component overflow.
 * 3. Stop at component preparation evidence without claiming owner visual acceptance.
 *
 * Original request (2026-08-02): complete basic development, unit tests, and necessary component Playwright tests.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigGuideProvider, useConfigGuide, useConfigGuideAnchor } from './config-guide'
import type { ConfigGuidePresentation } from './config-guide-driver'

const { initializationValue } = vi.hoisted(() => ({
  initializationValue: {
    projection: { initialized: true },
    open: vi.fn(),
  },
}))

vi.mock('@/components/config/project-initialization', () => ({
  useProjectInitialization: () => initializationValue,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  useVTHrefNavigate: () => vi.fn(),
}))

vi.mock('./config-guide-driver', () => ({
  presentConfigGuide: async (presentation: ConfigGuidePresentation) => {
    const popover = document.createElement('div')
    popover.dataset.testid = 'config-guide-browser-popover'
    popover.setAttribute('role', 'dialog')
    popover.textContent = `${presentation.label}: ${presentation.signal?.detail ?? ''}`
    document.body.append(popover)
    return () => popover.remove()
  },
}))

function GuideBrowserHarness({ width }: { width: number }) {
  const guide = useConfigGuide()
  const anchor = useConfigGuideAnchor('project-binding', {
    status: 'required',
    title: 'Configure Project Binding',
    detail: 'Choose the launch-project Store and References before continuing.',
  })

  if (!guide) return null
  return (
    <main
      data-testid="guide-browser-surface"
      className="@container min-w-0 overflow-x-clip rounded-lg border p-4"
      style={{ width: `${width}px`, maxWidth: 'calc(100vw - 32px)', height: '420px' }}
    >
      <button type="button" onClick={guide.start}>
        Start Guide
      </button>
      <button type="button" onClick={guide.cancel}>
        Cancel Guide
      </button>
      <section {...anchor} className="mt-6 min-w-0 rounded-lg border p-4">
        <h2>Project Binding</h2>
        <p className="break-all">
          project:openspec/references/a-team-owned-reference-that-must-wrap-inside-the-guide-target
        </p>
      </section>
    </main>
  )
}

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  )
})

afterEach(() => {
  cleanup()
  document
    .querySelectorAll('[data-testid="config-guide-browser-popover"]')
    .forEach((element) => element.remove())
  vi.unstubAllGlobals()
})

describe.each([
  ['desktop', 720],
  ['narrow', 320],
] as const)('Config Guide %s Chromium fixture', (_label, width) => {
  it('presents the real semantic target without component overflow', async () => {
    const rendered = render(
      <ConfigGuideProvider enabled>
        <GuideBrowserHarness width={width} />
      </ConfigGuideProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Guide' }))

    await waitFor(() =>
      expect(document.querySelector('[data-testid="config-guide-browser-popover"]')).not.toBeNull()
    )
    const surface = screen.getByTestId('guide-browser-surface')
    const target = document.getElementById('config-guide-project-binding')
    expect(target).not.toBeNull()
    expect(target).toHaveAttribute('data-config-guide-stage', 'project-binding')
    expect(target).toHaveAttribute('tabindex', '-1')
    expect(target).toHaveFocus()
    expect(surface.scrollWidth).toBeLessThanOrEqual(surface.clientWidth)

    rendered.unmount()
  })
})
