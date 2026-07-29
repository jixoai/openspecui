/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Verify live mobile navigation resolves only canonical project tabs.
 * 2. Verify static and live mobile navigation omit Config-owned Context and retired Stores.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Owner Context direction (2026-07-29): Resolved Context is a Config action, not a mobile tab.
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
    mainTabs: ['/dashboard', '/config', '/context', '/stores'],
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

  it('discards retired Context and Stores tab ids in live mode', () => {
    render(<MobileTabBar />)

    expect(screen.getByRole('link', { name: 'Config' })).toHaveAttribute('href', '/config')
    expect(screen.queryByRole('link', { name: 'Context' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Stores' })).toBeNull()
  })

  it('omits Context and Stores from canonical static navigation', () => {
    modeState.isStatic = true

    render(<MobileTabBar />)

    expect(screen.getByRole('link', { name: 'Config' })).toHaveAttribute('href', '/config')
    expect(screen.queryByRole('link', { name: 'Context' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Stores' })).toBeNull()
  })
})
