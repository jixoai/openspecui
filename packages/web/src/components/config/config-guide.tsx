/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Persist one adaptive Config Guide runtime across route-backed owner pages.
 * 2. Register semantic anchors and projection-derived signals without creating duplicate subscriptions.
 * 3. Own route settlement, target failure, focus restoration, reduced motion, cancel, and restart.
 * 4. Keep the lazy Driver adapter presentation-only while the typed reducer owns progression.
 *
 * Original request (2026-08-01): add a Guide action to Config for OpenSpec project setup.
 */
import { useProjectInitialization } from '@/components/config/project-initialization'
import {
  CONFIG_GUIDE_STAGES,
  CONFIG_GUIDE_STAGE_META,
  INITIAL_CONFIG_GUIDE_STATE,
  reduceConfigGuide,
  type ConfigGuideStageId,
  type ConfigGuideStageSignal,
} from '@/lib/config-guide'
import { useVTHrefNavigate } from '@/lib/view-transitions/navigation'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { presentConfigGuide } from './config-guide-driver'

interface ConfigGuideAnchorRecord {
  element: HTMLElement
  signal: ConfigGuideStageSignal
}

interface ConfigGuideContextValue {
  canStart: boolean
  active: boolean
  start(): void
  restart(): void
  cancel(): void
  register(
    stage: ConfigGuideStageId,
    element: HTMLElement,
    signal: ConfigGuideStageSignal
  ): () => void
}

const ConfigGuideContext = createContext<ConfigGuideContextValue | null>(null)

function reducedMotionPreferred(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

async function waitForAnchor(
  records: Map<ConfigGuideStageId, ConfigGuideAnchorRecord>,
  stage: ConfigGuideStageId,
  cancelled: () => boolean
): Promise<ConfigGuideAnchorRecord | null> {
  const timeoutAt = Date.now() + 5_000
  while (!cancelled() && Date.now() < timeoutAt) {
    const record = records.get(stage)
    if (record?.element.isConnected) return record
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return null
}

/** Access the root-owned adaptive Guide runtime. */
export function useConfigGuide() {
  return useContext(ConfigGuideContext)
}

/** Register one route-local semantic target and its projection-owned Guide signal. */
export function useConfigGuideAnchor(stage: ConfigGuideStageId, signal: ConfigGuideStageSignal) {
  const guide = useConfigGuide()
  const [element, setElement] = useState<HTMLElement | null>(null)
  const { detail, status, title } = signal

  useEffect(() => {
    if (!guide || !element) return
    return guide.register(stage, element, { detail, status, title })
  }, [detail, element, guide, stage, status, title])

  return {
    ref: setElement,
    id: CONFIG_GUIDE_STAGE_META[stage].anchor,
    'data-config-guide-stage': stage,
  }
}

export function ConfigGuideProvider({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) {
  const initialization = useProjectInitialization()
  const navigate = useVTHrefNavigate()
  const [state, dispatch] = useReducer(reduceConfigGuide, INITIAL_CONFIG_GUIDE_STATE)
  const [anchorRevision, setAnchorRevision] = useState(0)
  const recordsRef = useRef(new Map<ConfigGuideStageId, ConfigGuideAnchorRecord>())
  const cleanupPresentationRef = useRef<(() => void) | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const canStart = enabled && initialization?.projection?.initialized === true

  const restoreFocus = useCallback(() => {
    const element = restoreFocusRef.current
    restoreFocusRef.current = null
    if (element?.isConnected) element.focus({ preventScroll: true })
  }, [])

  const start = useCallback(() => {
    if (!canStart) {
      initialization?.open()
      return
    }
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    dispatch({ type: 'start' })
  }, [canStart, initialization])

  const restart = useCallback(() => {
    if (!canStart) return
    cleanupPresentationRef.current?.()
    dispatch({ type: 'restart' })
  }, [canStart])

  const cancel = useCallback(() => dispatch({ type: 'cancel' }), [])

  const register = useCallback(
    (stage: ConfigGuideStageId, element: HTMLElement, signal: ConfigGuideStageSignal) => {
      const record = { element, signal }
      recordsRef.current.set(stage, record)
      setAnchorRevision((revision) => revision + 1)
      dispatch({ type: 'observe', stage, signal })
      return () => {
        if (recordsRef.current.get(stage) === record) {
          recordsRef.current.delete(stage)
          setAnchorRevision((revision) => revision + 1)
        }
      }
    },
    []
  )

  useEffect(() => {
    const handleStart = () => start()
    window.addEventListener('openspecui:start-config-guide', handleStart)
    return () => window.removeEventListener('openspecui:start-config-guide', handleStart)
  }, [start])

  useEffect(() => {
    if (
      state.lifecycle !== 'active' &&
      state.lifecycle !== 'target-failed' &&
      state.lifecycle !== 'complete'
    ) {
      return
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cancel, state.lifecycle])

  useEffect(() => {
    cleanupPresentationRef.current?.()
    cleanupPresentationRef.current = null
    if (!enabled) return
    if (state.lifecycle === 'idle') return
    if (state.lifecycle === 'cancelled') {
      restoreFocus()
      return
    }

    let cancelled = false
    void (async () => {
      if (state.lifecycle === 'complete') {
        cleanupPresentationRef.current = await presentConfigGuide({
          kind: 'complete',
          label: 'Configuration complete',
          canGoBack: false,
          reducedMotion: reducedMotionPreferred(),
          onNext: () => {
            dispatch({ type: 'dismiss' })
            restoreFocus()
          },
          onPrevious: () => undefined,
          onCancel: () => {
            dispatch({ type: 'dismiss' })
            restoreFocus()
          },
        })
        return
      }
      if (state.lifecycle === 'target-failed' && state.stage) {
        cleanupPresentationRef.current = await presentConfigGuide({
          kind: 'target-failed',
          label: CONFIG_GUIDE_STAGE_META[state.stage].label,
          canGoBack: false,
          reducedMotion: reducedMotionPreferred(),
          onNext: () => dispatch({ type: 'retry-target' }),
          onPrevious: () => undefined,
          onCancel: cancel,
        })
        return
      }
      if (state.lifecycle !== 'active' || !state.stage) return

      const stage = state.stage
      const meta = CONFIG_GUIDE_STAGE_META[stage]
      const current = recordsRef.current.get(stage)
      if (!current?.element.isConnected) await navigate({ href: meta.route })
      const target = await waitForAnchor(recordsRef.current, stage, () => cancelled)
      if (cancelled) return
      if (!target) {
        dispatch({ type: 'target-missing', stage })
        return
      }
      dispatch({ type: 'observe', stage, signal: target.signal })
      if (target.signal.status === 'ready' && !state.reviewing) return

      if (!target.element.hasAttribute('tabindex')) target.element.tabIndex = -1
      target.element.focus({ preventScroll: true })
      cleanupPresentationRef.current = await presentConfigGuide({
        kind: 'stage',
        element: target.element,
        label: meta.label,
        signal: target.signal,
        canGoBack: stage !== CONFIG_GUIDE_STAGES[0],
        reducedMotion: reducedMotionPreferred(),
        onNext: () => dispatch({ type: 'next' }),
        onPrevious: () => dispatch({ type: 'previous' }),
        onCancel: cancel,
      })
    })().catch(() => {
      if (state.stage) dispatch({ type: 'target-missing', stage: state.stage })
    })

    return () => {
      cancelled = true
      cleanupPresentationRef.current?.()
      cleanupPresentationRef.current = null
    }
  }, [anchorRevision, cancel, enabled, navigate, restoreFocus, state])

  const value = useMemo<ConfigGuideContextValue>(
    () => ({
      canStart,
      active:
        state.lifecycle === 'active' ||
        state.lifecycle === 'target-failed' ||
        state.lifecycle === 'complete',
      start,
      restart,
      cancel,
      register,
    }),
    [canStart, cancel, register, restart, start, state.lifecycle]
  )

  return <ConfigGuideContext.Provider value={value}>{children}</ConfigGuideContext.Provider>
}
