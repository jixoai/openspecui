/**
 * Orthogonal intents (created 2026-08-04 Asia/Shanghai):
 * 1. Prove progressive mask bands scale from the supplied blur-level count.
 * 2. Prove the performance-oriented default renders three filter layers and one surface layer.
 *
 * Original request (2026-08-04): refine Kanban edge fusion from Magic UI Progressive Blur while reducing blurLevels because eight instances render together.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ProgressiveBlur } from './progressive-blur'

afterEach(cleanup)

describe('ProgressiveBlur', () => {
  it('uses three dynamically scaled layers by default', () => {
    const { container } = render(<ProgressiveBlur position="top" />)
    const veil = container.firstElementChild
    const layers = container.querySelectorAll<HTMLElement>('[data-progressive-blur-layer]')

    expect(veil).toHaveAttribute('data-progressive-blur-levels', '3')
    expect(layers).toHaveLength(3)
    expect(layers[0]?.style.maskImage).toContain('33.3333%')
    expect(layers[1]?.style.maskImage).toContain('66.6667%')
    expect(layers[2]?.style.maskImage).toContain('66.6667%')
    expect(container.querySelectorAll('[data-progressive-blur-surface]')).toHaveLength(1)
  })

  it('recalculates band widths for a custom level count', () => {
    const { container } = render(<ProgressiveBlur position="bottom" blurLevels={[0.5, 1, 2, 4]} />)
    const layers = container.querySelectorAll<HTMLElement>('[data-progressive-blur-layer]')

    expect(layers).toHaveLength(4)
    expect(layers[0]?.style.maskImage).toContain('25%')
    expect(layers[3]?.style.maskImage).toContain('75%')
    expect(layers[0]?.style.maskImage).toContain('to bottom')
  })
})
