/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Render one React-owned Config Guide spotlight without mutating route-owned target DOM.
 * 2. Position a Base UI popover against a registered semantic anchor using OpenSpecUI components and tokens.
 * 3. Block pointer interaction outside the theme-aware spotlight while preserving target, keyboard, dismissal, and reduced-motion behavior.
 *
 * Original request (2026-08-02): replace Driver.js with a headless framework and unify Guide styling with OpenSpecUI.
 * Owner correction (2026-08-03): use one event-aware SVG even-odd mask that mirrors project bevel geometry.
 * Owner correction (2026-08-03): adapt the veil color so light and dark surfaces both preserve visible focus.
 */
import type { ConfigGuideStageSignal } from '@/lib/config-guide'
import { cn } from '@/lib/utils'
import { Popover } from '@base-ui/react/popover'
import { X } from 'lucide-react'
import { useEffect, useId, useState, type ReactNode, type SyntheticEvent } from 'react'
import { Button } from '../button'
import {
  createConfigGuideSpotlightPaths,
  readConfigGuideSpotlightGeometry,
  type ConfigGuideSpotlightGeometry,
} from './config-guide-spotlight'

const SPOTLIGHT_PADDING = 8

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

export interface ConfigGuidePresentationCopy {
  description?: string
  nextLabel: 'Continue' | 'Retry' | 'Done'
  showNext: boolean
}

/** Derive presentation-only copy without creating readiness or completion authority. */
export function getConfigGuidePresentationCopy(
  presentation: ConfigGuidePresentation
): ConfigGuidePresentationCopy {
  const isTerminal = presentation.kind !== 'stage'
  return {
    description:
      presentation.kind === 'complete'
        ? 'Resolved Context is current and the selected Root is usable.'
        : presentation.kind === 'target-failed'
          ? 'The semantic Guide target did not mount. Retry after the route is available.'
          : presentation.signal?.detail,
    nextLabel:
      presentation.kind === 'complete'
        ? 'Done'
        : presentation.kind === 'target-failed'
          ? 'Retry'
          : 'Continue',
    showNext: isTerminal || presentation.signal?.status === 'ready',
  }
}

function useSpotlightGeometry(element: HTMLElement | undefined): ConfigGuideSpotlightGeometry {
  const [geometry, setGeometry] = useState<ConfigGuideSpotlightGeometry>(() =>
    readConfigGuideSpotlightGeometry(element, SPOTLIGHT_PADDING)
  )

  useEffect(() => {
    let frame = 0
    const update = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() =>
        setGeometry(readConfigGuideSpotlightGeometry(element, SPOTLIGHT_PADDING))
      )
    }
    update()

    const resizeObserver =
      element && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (element) resizeObserver?.observe(element)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      window.visualViewport?.removeEventListener('resize', update)
      window.visualViewport?.removeEventListener('scroll', update)
    }
  }, [element])

  return geometry
}

function blockOutsideInteraction(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

function ConfigGuideSpotlight({ element }: { element: HTMLElement | undefined }) {
  const geometry = useSpotlightGeometry(element)
  const paths = createConfigGuideSpotlightPaths(geometry)

  return (
    <svg
      data-config-guide-overlay
      className="fixed left-0 top-0 z-[80]"
      width={geometry.viewportWidth}
      height={geometry.viewportHeight}
      viewBox={`0 0 ${geometry.viewportWidth} ${geometry.viewportHeight}`}
      preserveAspectRatio="none"
      pointerEvents="none"
      aria-hidden
    >
      <path
        data-config-guide-overlay-mask
        d={paths.maskPath}
        fill="var(--config-guide-mask)"
        fillRule="evenodd"
        clipRule="evenodd"
        pointerEvents="visiblePainted"
        onPointerDown={blockOutsideInteraction}
        onPointerUp={blockOutsideInteraction}
        onClick={blockOutsideInteraction}
        onContextMenu={blockOutsideInteraction}
        onWheel={blockOutsideInteraction}
      />
      {paths.holePath ? (
        <path
          data-config-guide-spotlight
          d={paths.holePath}
          fill="none"
          stroke="var(--primary)"
          strokeOpacity="0.7"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      ) : null}
    </svg>
  )
}

function GuideActions({
  presentation,
  copy,
}: {
  presentation: ConfigGuidePresentation
  copy: ConfigGuidePresentationCopy
}) {
  return (
    <div className="border-border mt-4 flex items-center justify-end gap-2 border-t pt-3">
      {presentation.canGoBack ? (
        <Button
          data-config-guide-action="previous"
          variant="secondary"
          size="sm"
          onClick={presentation.onPrevious}
        >
          Back
        </Button>
      ) : null}
      {copy.showNext ? (
        <Button
          data-config-guide-action="next"
          variant="primary"
          size="sm"
          autoFocus={presentation.kind !== 'stage'}
          onClick={presentation.onNext}
        >
          {copy.nextLabel}
        </Button>
      ) : null}
    </div>
  )
}

function GuideSurface({
  presentation,
  title,
  description,
  children,
}: {
  presentation: ConfigGuidePresentation
  title: ReactNode
  description: ReactNode
  children: ReactNode
}) {
  return (
    <div className="relative">
      <Button
        data-config-guide-action="close"
        variant="ghost"
        size="icon-sm"
        aria-label="Close Guide"
        className="text-muted-foreground hover:text-foreground absolute -right-1 -top-1"
        onClick={presentation.onCancel}
      >
        <X className="h-4 w-4" aria-hidden />
      </Button>
      <div className="min-w-0 pr-8">{title}</div>
      <div className="mt-1 min-w-0">{description}</div>
      {children}
    </div>
  )
}

function AnchoredGuidePopover({ presentation }: { presentation: ConfigGuidePresentation }) {
  const copy = getConfigGuidePresentationCopy(presentation)
  const animate = !presentation.reducedMotion

  return (
    <Popover.Root
      open
      modal={false}
      triggerId={presentation.element?.id}
      onOpenChange={() => undefined}
    >
      <Popover.Portal>
        <Popover.Positioner
          anchor={presentation.element}
          positionMethod="fixed"
          side="bottom"
          align="center"
          sideOffset={12}
          collisionPadding={16}
          className="z-[81] max-w-[calc(100vw-1rem)] outline-none"
        >
          <Popover.Popup
            data-config-guide-popover
            data-config-guide-kind={presentation.kind}
            data-config-guide-anchor={presentation.element?.id}
            initialFocus
            finalFocus={false}
            className={cn(
              'bg-popover text-popover-foreground border-border w-[min(22rem,calc(100vw-1rem))] rounded-lg border p-4 shadow-lg outline-none',
              animate &&
                'origin-(--transform-origin) transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0'
            )}
          >
            <GuideSurface
              presentation={presentation}
              title={
                <Popover.Title className="text-base font-semibold leading-snug">
                  {presentation.label}
                </Popover.Title>
              }
              description={
                copy.description ? (
                  <Popover.Description className="text-muted-foreground text-sm leading-relaxed">
                    {copy.description}
                  </Popover.Description>
                ) : null
              }
            >
              <GuideActions presentation={presentation} copy={copy} />
            </GuideSurface>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function CenteredGuideDialog({ presentation }: { presentation: ConfigGuidePresentation }) {
  const copy = getConfigGuidePresentationCopy(presentation)
  const titleId = useId()
  const descriptionId = useId()

  return (
    <div
      data-config-guide-popover
      data-config-guide-kind={presentation.kind}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="bg-popover text-popover-foreground border-border fixed left-1/2 top-1/2 z-[81] w-[min(22rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border p-4 shadow-lg outline-none"
    >
      <GuideSurface
        presentation={presentation}
        title={
          <h2 id={titleId} className="text-base font-semibold leading-snug">
            {presentation.label}
          </h2>
        }
        description={
          <p id={descriptionId} className="text-muted-foreground text-sm leading-relaxed">
            {copy.description}
          </p>
        }
      >
        <GuideActions presentation={presentation} copy={copy} />
      </GuideSurface>
    </div>
  )
}

/** Render one React-owned Guide presentation inside the persistent root Provider tree. */
export function ConfigGuidePresentationLayer({
  presentation,
}: {
  presentation: ConfigGuidePresentation
}) {
  return (
    <>
      <ConfigGuideSpotlight element={presentation.element} />
      {presentation.element ? (
        <AnchoredGuidePopover presentation={presentation} />
      ) : (
        <CenteredGuideDialog presentation={presentation} />
      )}
    </>
  )
}
