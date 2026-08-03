/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Measure the Config NavBar and page geometry in real narrow and wide Chromium containers.
 * 2. Prove the production main host remains the only page scroll owner without horizontal overflow.
 * 3. Prove the stable NavBar precedes the route-transition-owned header and content surface.
 * 4. Stop at component-browser preparation rather than claiming owner visual acceptance.
 *
 * Owner Config-workbench decision (2026-08-01): narrow Config navigation must be self-describing and overflow-free.
 * Owner correction (2026-08-03): replace the card grid with a top NavBar that becomes icon-only by container width.
 * Owner correction (2026-08-03): use thin table-like separators; selection changes only foreground/background without shadow.
 * Owner acceptance boundary (2026-07-20): final end-to-end visual walkthrough belongs to the owner.
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigWorkbenchPage } from './config-workbench'

vi.mock('@/lib/static-mode', () => ({
  isStaticMode: () => false,
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

afterEach(() => cleanup())

function ConfigHarness({ width }: { width: number }) {
  return (
    <main
      data-testid="config-main-scroll-owner"
      className="main-content flex min-h-0 flex-col"
      style={{ width: `${width}px`, height: '520px' }}
    >
      <ConfigWorkbenchPage
        current="overview"
        header={
          <header>
            <h1>Config</h1>
          </header>
        }
      >
        <div className="grid min-w-0 gap-3">
          <section className="min-w-0 rounded-lg border p-4">
            <h2>Project Binding</h2>
            <p className="break-all">
              project:openspec/references/a-very-long-team-owned-reference-identity-that-must-wrap
            </p>
          </section>
          {Array.from({ length: 10 }, (_, index) => (
            <section key={index} className="min-w-0 rounded-lg border p-4">
              Readiness row {index + 1}
            </section>
          ))}
        </div>
      </ConfigWorkbenchPage>
    </main>
  )
}

describe('ConfigWorkbenchPage narrow browser geometry', () => {
  it('keeps every owner discoverable as an icon-only top NavBar without horizontal overflow', async () => {
    render(<ConfigHarness width={320} />)

    const workbench = screen.getByTestId('config-workbench')
    const navigation = screen.getByRole('navigation', { name: 'Config sections' })
    const pageScrollOwner = screen.getByTestId('config-main-scroll-owner')

    await waitFor(() => expect(workbench.getBoundingClientRect().width).toBe(320))

    expect(navigation.querySelectorAll('a')).toHaveLength(7)
    expect(navigation).toHaveAttribute('data-config-workbench-navbar')
    expect(navigation).toHaveClass('gap-0', 'border-b', 'divide-x', 'divide-border/20')
    expect(navigation).not.toHaveClass('border-y', 'border-t')
    expect(workbench.firstElementChild).toBe(navigation)
    expect(navigation.nextElementSibling).toHaveClass('vt-detail-content')
    const selected = screen.getByRole('link', { name: 'Overview' })
    expect(selected).toHaveClass('bg-primary', 'text-primary-foreground')
    expect(selected.className).not.toContain('border-')
    expect(selected.className).not.toContain('rounded-')
    expect(selected.className).not.toContain('shadow')
    expect(getComputedStyle(navigation).borderTopWidth).toBe('0px')
    expect(getComputedStyle(navigation).borderBottomWidth).toBe('1px')
    expect(getComputedStyle(selected).borderRightWidth).toBe('1px')
    expect(getComputedStyle(selected).borderRightColor).not.toBe(
      getComputedStyle(navigation).borderBottomColor
    )
    expect(getComputedStyle(selected).borderRadius).toBe('0px')
    expect(getComputedStyle(selected).boxShadow).toBe('none')
    expect(getComputedStyle(screen.getByTestId('config-nav-label-overview')).display).toBe('none')
    expect(workbench.querySelector('[data-config-page-scroll-owner="true"]')).toBeNull()
    expect(navigation.scrollWidth).toBeLessThanOrEqual(navigation.clientWidth)
    expect(pageScrollOwner.scrollWidth).toBeLessThanOrEqual(pageScrollOwner.clientWidth)
    expect(workbench.scrollWidth).toBeLessThanOrEqual(workbench.clientWidth)
    expect(pageScrollOwner.scrollHeight).toBeGreaterThan(pageScrollOwner.clientHeight)
    expect(getComputedStyle(pageScrollOwner).overflowY).toBe('auto')
  })

  it('reveals NavBar labels when the Config container has sufficient width', async () => {
    render(<ConfigHarness width={1120} />)

    const workbench = screen.getByTestId('config-workbench')
    const navigation = screen.getByRole('navigation', { name: 'Config sections' })

    await waitFor(() => expect(workbench.getBoundingClientRect().width).toBe(1120))

    expect(getComputedStyle(screen.getByTestId('config-nav-label-overview')).display).not.toBe(
      'none'
    )
    expect(navigation.scrollWidth).toBeLessThanOrEqual(navigation.clientWidth)
  })
})
