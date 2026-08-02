/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Prove the root Guide orchestrator navigates and waits for route-owned semantic anchors.
 * 2. Prove replacement projection signals, not presentation callbacks, advance paused stages.
 * 3. Prove missing targets, cancellation, restart, focus restoration, and reduced motion remain explicit.
 *
 * Original request (2026-08-02): implement the adaptive Config Guide with unit and component evidence.
 */
import {
  CONFIG_GUIDE_STAGE_META,
  CONFIG_GUIDE_STAGES,
  type ConfigGuideStageId,
  type ConfigGuideStageSignal,
} from '@/lib/config-guide'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigGuideProvider, useConfigGuide, useConfigGuideAnchor } from './config-guide'
import type { ConfigGuidePresentation } from './config-guide-driver'

const { initializationValue, navigateMock, presentMock } = vi.hoisted(() => {
  const initializationOpen = vi.fn()
  return {
    initializationValue: {
      projection: { initialized: true },
      open: initializationOpen,
    },
    navigateMock: vi.fn(),
    presentMock: vi.fn(),
  }
})

let navigateRoute: ((href: string) => void) | null = null

vi.mock('@/components/config/project-initialization', () => ({
  useProjectInitialization: () => initializationValue,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  useVTHrefNavigate: () => navigateMock,
}))

vi.mock('./config-guide-driver', () => ({
  presentConfigGuide: presentMock,
}))

function stageSignal(stage: ConfigGuideStageId, status: ConfigGuideStageSignal['status']) {
  return {
    status,
    title: `${CONFIG_GUIDE_STAGE_META[stage].label} ${status}`,
    detail: `${stage} is ${status}`,
  }
}

function StageAnchor({
  signal,
  stage,
}: {
  signal: ConfigGuideStageSignal
  stage: ConfigGuideStageId
}) {
  const anchor = useConfigGuideAnchor(stage, signal)
  return (
    <section {...anchor} data-testid={`guide-anchor-${stage}`}>
      {CONFIG_GUIDE_STAGE_META[stage].label}
    </section>
  )
}

function GuideHarness({ mountTargets = true }: { mountTargets?: boolean }) {
  const guide = useConfigGuide()
  const [route, setRoute] = useState('/config')
  const [signals, setSignals] = useState<Record<ConfigGuideStageId, ConfigGuideStageSignal>>(
    () =>
      Object.fromEntries(
        CONFIG_GUIDE_STAGES.map((stage) => [stage, stageSignal(stage, 'required')])
      ) as Record<ConfigGuideStageId, ConfigGuideStageSignal>
  )

  useEffect(() => {
    navigateRoute = setRoute
    return () => {
      navigateRoute = null
    }
  }, [])

  if (!guide) return null
  const currentStage = CONFIG_GUIDE_STAGES.find(
    (stage) => CONFIG_GUIDE_STAGE_META[stage].route === route
  )

  return (
    <div>
      <button type="button" onClick={guide.start}>
        Start Guide
      </button>
      <button type="button" onClick={guide.restart}>
        Restart Guide
      </button>
      <button type="button" onClick={guide.cancel}>
        Cancel Guide
      </button>
      <output data-testid="guide-route">{route}</output>
      {currentStage ? (
        <button
          type="button"
          onClick={() =>
            setSignals((current) => ({
              ...current,
              [currentStage]: stageSignal(currentStage, 'ready'),
            }))
          }
        >
          Replace {CONFIG_GUIDE_STAGE_META[currentStage].label} projection
        </button>
      ) : null}
      {mountTargets && currentStage ? (
        <StageAnchor stage={currentStage} signal={signals[currentStage]} />
      ) : null}
    </div>
  )
}

function latestPresentation(): ConfigGuidePresentation {
  const calls = presentMock.mock.calls as [ConfigGuidePresentation][]
  const latest = calls.at(-1)?.[0]
  if (!latest) throw new Error('Expected a Config Guide presentation.')
  return latest
}

describe('ConfigGuideProvider', () => {
  beforeEach(() => {
    navigateMock.mockImplementation(async ({ href }: { href: string }) => {
      navigateRoute?.(href)
    })
    presentMock.mockResolvedValue(vi.fn())
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false }))
    )
  })

  afterEach(() => {
    cleanup()
    navigateRoute = null
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('waits for each route anchor and advances only from replacement ready projections', async () => {
    render(
      <ConfigGuideProvider enabled>
        <GuideHarness />
      </ConfigGuideProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Guide' }))
    await waitFor(() =>
      expect(screen.getByTestId('guide-route')).toHaveTextContent('/config/project')
    )
    await waitFor(() => expect(latestPresentation().label).toBe('Project Binding'))

    act(() => latestPresentation().onNext())
    expect(screen.getByTestId('guide-route')).toHaveTextContent('/config/project')

    for (const stage of CONFIG_GUIDE_STAGES) {
      await waitFor(() =>
        expect(screen.getByTestId('guide-route')).toHaveTextContent(
          CONFIG_GUIDE_STAGE_META[stage].route
        )
      )
      fireEvent.click(
        screen.getByRole('button', {
          name: `Replace ${CONFIG_GUIDE_STAGE_META[stage].label} projection`,
        })
      )
    }

    await waitFor(() => expect(latestPresentation().kind).toBe('complete'))
    expect(latestPresentation().canGoBack).toBe(false)
  })

  it('restores focus on cancel and restarts from the first unresolved projection', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: true }))
    )
    render(
      <ConfigGuideProvider enabled>
        <GuideHarness />
      </ConfigGuideProvider>
    )

    const start = screen.getByRole('button', { name: 'Start Guide' })
    start.focus()
    fireEvent.click(start)
    await waitFor(() => expect(latestPresentation().kind).toBe('stage'))
    expect(latestPresentation().reducedMotion).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(start).toHaveFocus())

    fireEvent.click(screen.getByRole('button', { name: 'Restart Guide' }))
    await waitFor(() => expect(latestPresentation().label).toBe('Project Binding'))
  })

  it('turns an unmounted semantic target into a retryable typed failure', async () => {
    vi.useFakeTimers()
    render(
      <ConfigGuideProvider enabled>
        <GuideHarness mountTargets={false} />
      </ConfigGuideProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Start Guide' }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_100)
    })

    expect(latestPresentation().kind).toBe('target-failed')
    expect(latestPresentation().label).toBe('Project Binding')
    expect(latestPresentation().canGoBack).toBe(false)
  })
})
