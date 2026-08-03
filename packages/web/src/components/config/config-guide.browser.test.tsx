/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Exercise the Provider and React-owned Base UI/Spotlight presentation against a Chromium DOM.
 * 2. Prove desktop and narrow Config Guide targets remain present without horizontal component overflow.
 * 3. Prove ready stages require explicit Continue before completion and terminal controls dismiss cleanly.
 * 4. Prove one SVG even-odd bevel mask blocks outside interaction while the real target remains interactive.
 * 5. Stop at component preparation evidence without claiming owner visual acceptance.
 *
 * Original request (2026-08-02): complete basic development, unit tests, and necessary component Playwright tests.
 * Owner correction (2026-08-03): prevent no-interaction completion and replace four mask divs with a bevel SVG hole.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigGuideProvider, useConfigGuide, useConfigGuideAnchor } from './config-guide'
import { ConfigGuidePresentationLayer } from './config-guide-presentation'

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

function CompleteGuideBrowserHarness() {
  const guide = useConfigGuide()
  const projectBinding = useConfigGuideAnchor('project-binding', {
    status: 'ready',
    title: 'Project Binding ready',
    detail: 'Project Binding is ready.',
  })
  const activeRoot = useConfigGuideAnchor('active-root', {
    status: 'ready',
    title: 'Active Root ready',
    detail: 'Active Root is ready.',
  })
  const agentDelivery = useConfigGuideAnchor('agent-delivery', {
    status: 'ready',
    title: 'Agent Delivery ready',
    detail: 'Agent Delivery is ready.',
  })
  const resolvedContext = useConfigGuideAnchor('resolved-context', {
    status: 'ready',
    title: 'Resolved Context ready',
    detail: 'Resolved Context is ready.',
  })

  if (!guide) return null
  return (
    <main className="space-y-3 p-4">
      <button type="button" onClick={guide.start}>
        Start Complete Guide
      </button>
      <section {...projectBinding}>Project Binding</section>
      <section {...activeRoot}>Active Root</section>
      <section {...agentDelivery}>Agent Delivery</section>
      <section {...resolvedContext}>Resolved Context</section>
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

    await waitFor(() => {
      expect(document.querySelectorAll('[data-config-guide-popover]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-config-guide-overlay]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-config-guide-overlay-mask]')).toHaveLength(1)
      expect(document.querySelectorAll('[data-config-guide-spotlight]')).toHaveLength(1)
    })
    expect(screen.getByRole('button', { name: 'Close Guide' })).toBeVisible()
    const surface = screen.getByTestId('guide-browser-surface')
    const target = document.getElementById('config-guide-project-binding')
    expect(target).not.toBeNull()
    if (!(target instanceof HTMLElement)) {
      throw new Error('Expected the Project Binding Guide anchor to remain mounted')
    }
    expect(target).toHaveAttribute('data-config-guide-stage', 'project-binding')
    expect(target).toHaveAttribute('tabindex', '-1')
    expect(target).not.toHaveAttribute('inert')
    const activeElement = document.activeElement
    expect(activeElement).toBeInstanceOf(HTMLElement)
    if (!(activeElement instanceof HTMLElement)) {
      throw new Error('Expected Guide focus to remain on an actionable surface')
    }
    const popover = document.querySelector<HTMLElement>('[data-config-guide-popover]')
    expect(activeElement === target || popover?.contains(activeElement)).toBe(true)
    expect(popover).toHaveAttribute('data-config-guide-anchor', 'config-guide-project-binding')
    expect(surface.scrollWidth).toBeLessThanOrEqual(surface.clientWidth)
    const mask = document.querySelector<SVGPathElement>('[data-config-guide-overlay-mask]')
    expect(mask).toHaveAttribute('fill-rule', 'evenodd')
    expect(mask).toHaveAttribute('pointer-events', 'visiblePainted')
    expect(document.querySelectorAll('[data-config-guide-overlay-block]')).toHaveLength(0)
    const targetBounds = target.getBoundingClientRect()
    expect(
      target.contains(
        document.elementFromPoint(
          targetBounds.left + targetBounds.width / 2,
          targetBounds.top + targetBounds.height / 2
        )
      )
    ).toBe(true)
    expect(document.elementFromPoint(1, 1)).toBe(mask)
    const spotlightPath = document.querySelector('[data-config-guide-spotlight]')?.getAttribute('d')
    expect(spotlightPath).not.toContain('A')
    if (CSS.supports('corner-shape', 'bevel')) {
      const [, startX] = spotlightPath?.split(' ') ?? []
      expect(Number(startX)).toBeGreaterThan(Math.max(0, targetBounds.left - 8))
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(document.querySelectorAll('[data-config-guide-popover]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-config-guide-overlay]')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel Guide' }))
    await waitFor(() => {
      expect(document.querySelectorAll('[data-config-guide-popover]')).toHaveLength(0)
      expect(document.querySelectorAll('[data-config-guide-overlay]')).toHaveLength(0)
    })

    rendered.unmount()
  })
})

describe('Config Guide completion Chromium fixture', () => {
  it('requires explicit Continue through ready stages before anchored completion', async () => {
    render(
      <ConfigGuideProvider enabled>
        <CompleteGuideBrowserHarness />
      </ConfigGuideProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Complete Guide' }))

    const stageLabels = ['Project Binding', 'Active Root', 'Agent Delivery', 'Resolved Context']
    for (const label of stageLabels) {
      await waitFor(() =>
        expect(document.querySelector('[data-config-guide-popover]')).toHaveTextContent(label)
      )
      expect(document.querySelector('[data-config-guide-popover]')).not.toHaveTextContent(
        'Configuration complete'
      )
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    }

    await waitFor(() =>
      expect(document.querySelector('[data-config-guide-popover]')).toHaveTextContent(
        'Configuration complete'
      )
    )
    const resolvedContext = document.getElementById('config-guide-resolved-context')
    expect(resolvedContext).not.toHaveAttribute('inert')
    expect(document.querySelector('[data-config-guide-popover]')).toHaveAttribute(
      'data-config-guide-anchor',
      'config-guide-resolved-context'
    )
    const done = screen.getByRole('button', { name: 'Done' })
    expect(done).toBeVisible()
    expect(screen.getByRole('button', { name: 'Close Guide' })).toBeVisible()

    fireEvent.click(done)
    await waitFor(() => {
      expect(document.querySelectorAll('[data-config-guide-popover]')).toHaveLength(0)
      expect(document.querySelectorAll('[data-config-guide-overlay]')).toHaveLength(0)
    })
  })
})

describe('Config Guide target failure Chromium fixture', () => {
  it('centers the OpenSpecUI surface and focuses Retry', async () => {
    const onRetry = vi.fn()
    render(
      <ConfigGuidePresentationLayer
        presentation={{
          kind: 'target-failed',
          label: 'Project Binding',
          canGoBack: false,
          reducedMotion: true,
          onCancel: vi.fn(),
          onNext: onRetry,
          onPrevious: vi.fn(),
        }}
      />
    )

    const popover = await waitFor(() =>
      document.querySelector<HTMLElement>('[data-config-guide-popover]')
    )
    expect(popover).not.toBeNull()
    expect(popover).toHaveAttribute('data-config-guide-kind', 'target-failed')
    expect(popover).toHaveClass('bg-popover', 'border-border', 'rounded-lg')
    expect(document.querySelectorAll('[data-config-guide-overlay-mask]')).toHaveLength(1)
    expect(document.querySelectorAll('[data-config-guide-overlay-block]')).toHaveLength(0)
    expect(document.querySelector('[data-config-guide-spotlight]')).toBeNull()

    const retry = screen.getByRole('button', { name: 'Retry' })
    expect(retry).toBeVisible()
    expect(retry).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Close Guide' })).toBeVisible()
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
