/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Measure Config-local navigation and page geometry in a real narrow Chromium layout.
 * 2. Prove the production main host remains the only page scroll owner without horizontal overflow.
 * 3. Stop at component-browser preparation rather than claiming owner visual acceptance.
 *
 * Owner Config-workbench decision (2026-08-01): narrow Config navigation must be self-describing and overflow-free.
 * Owner acceptance boundary (2026-07-20): final end-to-end visual walkthrough belongs to the owner.
 */
import { render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
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

function NarrowConfigHarness() {
  return (
    <main
      data-testid="config-main-scroll-owner"
      className="main-content flex min-h-0 flex-col"
      style={{ width: '320px', height: '520px' }}
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
  it('keeps every owner discoverable with one vertical and no horizontal page scroll owner', async () => {
    render(<NarrowConfigHarness />)

    const workbench = screen.getByTestId('config-workbench')
    const navigation = screen.getByRole('navigation', { name: 'Config sections' })
    const pageScrollOwner = screen.getByTestId('config-main-scroll-owner')

    await waitFor(() => expect(workbench.getBoundingClientRect().width).toBe(320))

    expect(navigation.querySelectorAll('a')).toHaveLength(7)
    expect(workbench.querySelector('[data-config-page-scroll-owner="true"]')).toBeNull()
    expect(navigation.scrollWidth).toBeLessThanOrEqual(navigation.clientWidth)
    expect(pageScrollOwner.scrollWidth).toBeLessThanOrEqual(pageScrollOwner.clientWidth)
    expect(workbench.scrollWidth).toBeLessThanOrEqual(workbench.clientWidth)
    expect(pageScrollOwner.scrollHeight).toBeGreaterThan(pageScrollOwner.clientHeight)
    expect(getComputedStyle(pageScrollOwner).overflowY).toBe('auto')
  })
})
