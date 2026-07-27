/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Verify live mobile navigation resolves only canonical project tabs.
 * 2. Verify static mobile navigation exposes Context without a retired Stores entry.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MobileTabBar } from './mobile-tabbar'

const { modeState } = vi.hoisted(() => ({
  modeState: { isStatic: false },
}))

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => modeState.isStatic,
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => ({
    mainTabs: ['/dashboard', '/context', '/stores'],
    bottomTabs: [],
  }),
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    children,
    to,
    ...props
  }: { children?: ReactNode; to: string } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

describe('MobileTabBar', () => {
  afterEach(() => {
    cleanup()
    modeState.isStatic = false
  })

  it('renders Context and discards a retired Stores tab id in live mode', () => {
    render(<MobileTabBar />)

    expect(screen.getByRole('link', { name: 'Context' })).toHaveAttribute('href', '/context')
    expect(screen.queryByRole('link', { name: 'Stores' })).toBeNull()
  })

  it('renders Context without Stores from the canonical static navigation', () => {
    modeState.isStatic = true

    render(<MobileTabBar />)

    expect(screen.getByRole('link', { name: 'Context' })).toHaveAttribute('href', '/context')
    expect(screen.queryByRole('link', { name: 'Stores' })).toBeNull()
  })
})
