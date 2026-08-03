/**
 * Orthogonal intents (created 2026-08-04 Asia/Shanghai):
 * 1. Render a direction-aware progressive backdrop blur from a bounded level tuple.
 * 2. Scale overlapping mask bands from the actual level count instead of assuming eight levels.
 * 3. Preserve positioning-free Grid composition and expose one theme-owned surface layer.
 *
 * Original request (2026-08-04): refine Kanban edge fusion from Magic UI Progressive Blur while reducing blurLevels because eight instances render together.
 */
import { cn } from '@/lib/utils'
import type { ComponentPropsWithoutRef } from 'react'
import './progressive-blur.css'

/** Ordered blur radii with at least two levels for a meaningful progression. */
export type ProgressiveBlurLevels = readonly [number, number, ...number[]]

/** Configuration for one inert top or bottom progressive-blur veil. */
export interface ProgressiveBlurProps extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  position: 'top' | 'bottom'
  blurLevels?: ProgressiveBlurLevels
  surfaceClassName?: string
}

const DEFAULT_BLUR_LEVELS = [0.5, 2, 6] as const satisfies ProgressiveBlurLevels

function formatPercent(value: number): string {
  return Number(value.toFixed(4)).toString()
}

function createLayerMask(
  index: number,
  layerCount: number,
  position: ProgressiveBlurProps['position']
): string {
  const direction = position === 'bottom' ? 'to bottom' : 'to top'
  const step = 100 / layerCount

  if (index === layerCount - 1) {
    return `linear-gradient(${direction}, transparent ${formatPercent(100 - step)}%, black 100%)`
  }

  const transparentStart = index * step
  const opaqueStart = (index + 1) * step
  const opaqueEnd = (index + 2) * step
  const transparentEnd = (index + 3) * step
  return `linear-gradient(${direction}, transparent ${formatPercent(transparentStart)}%, black ${formatPercent(opaqueStart)}%, black ${formatPercent(opaqueEnd)}%, transparent ${formatPercent(transparentEnd)}%)`
}

/** Progressive backdrop blur whose overlapping bands scale with its blur-level count. */
export function ProgressiveBlur({
  position,
  blurLevels = DEFAULT_BLUR_LEVELS,
  surfaceClassName,
  className,
  ...divProps
}: ProgressiveBlurProps) {
  return (
    <div
      {...divProps}
      aria-hidden="true"
      data-progressive-blur={position}
      data-progressive-blur-levels={blurLevels.length}
      className={cn('progressive-blur grid', className)}
    >
      {blurLevels.map((blur, index) => {
        const maskImage = createLayerMask(index, blurLevels.length, position)
        return (
          <div
            key={`${blur}:${index}`}
            data-progressive-blur-layer={index}
            className="progressive-blur__layer"
            style={{
              zIndex: index + 1,
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              maskImage,
              WebkitMaskImage: maskImage,
            }}
          />
        )
      })}
      <div
        data-progressive-blur-surface=""
        className={cn('progressive-blur__surface', surfaceClassName)}
        style={{ zIndex: blurLevels.length + 1 }}
      />
    </div>
  )
}
