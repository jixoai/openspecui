/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Lazy-load Driver.js only while an adaptive Config Guide presentation is active.
 * 2. Translate typed Guide presentation commands into focus, mask, popover, and keyboard callbacks.
 * 3. Return presentation events without deriving readiness, mutation, navigation, or completion.
 *
 * Original request (2026-08-01): use a JavaScript guide library for Config onboarding.
 */
import type { ConfigGuideStageSignal } from '@/lib/config-guide'

export interface ConfigGuidePresentation {
  element?: HTMLElement
  label: string
  signal?: ConfigGuideStageSignal
  kind: 'stage' | 'target-failed' | 'complete'
  canGoBack: boolean
  reducedMotion: boolean
  onNext(): void
  onPrevious(): void
  onCancel(): void
}

/** Present one typed Guide command; the returned cleanup unloads active Driver runtime state. */
export async function presentConfigGuide(
  presentation: ConfigGuidePresentation
): Promise<() => void> {
  const [{ driver }, _styles] = await Promise.all([
    import('driver.js'),
    import('driver.js/dist/driver.css'),
  ])
  const signal = presentation.signal
  const isTerminal = presentation.kind !== 'stage'
  const showNext = isTerminal || signal?.status === 'ready'
  const nextLabel =
    presentation.kind === 'complete'
      ? 'Done'
      : presentation.kind === 'target-failed'
        ? 'Retry'
        : 'Continue'
  const description =
    presentation.kind === 'complete'
      ? 'Resolved Context is current and the selected Root is usable.'
      : presentation.kind === 'target-failed'
        ? 'The semantic Guide target did not mount. Retry after the route is available.'
        : signal?.detail
  const instance = driver({
    animate: !presentation.reducedMotion,
    smoothScroll: !presentation.reducedMotion,
    allowClose: false,
    allowKeyboardControl: true,
    disableActiveInteraction: false,
    stagePadding: 8,
    stageRadius: 10,
    showButtons: [
      ...(presentation.canGoBack ? (['previous'] as const) : []),
      ...(showNext ? (['next'] as const) : []),
      'close',
    ],
    nextBtnText: nextLabel,
    prevBtnText: 'Back',
    onNextClick: presentation.onNext,
    onPrevClick: presentation.onPrevious,
    onCloseClick: presentation.onCancel,
  })
  instance.highlight({
    element: presentation.element,
    disableActiveInteraction: false,
    popover: {
      title: presentation.label,
      description,
      side: presentation.element ? 'bottom' : 'top',
      align: 'start',
    },
  })
  return () => instance.destroy()
}
