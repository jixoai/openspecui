/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove the overlay titlebar occupies a distinct visual row before Workspace tabs in Chromium.
 * 2. Prove the visible App chrome remains page-contained without horizontal overflow.
 * 3. Prove compact titlebar geometry preserves the native control safe area.
 * 4. Keep the interactive brand toggle inside the same component browser boundary.
 * 5. Prove equal-height, edge-aligned sidebar/shell snapshots exchange through directional masks without scroll leakage.
 *
 * Original request (2026-07-30): "顶部区域缺少一个自绘制的 titlebar 区域，它是通过 overlay-window-controls 得来的，主语它可以拖拽窗口。"
 * Owner correction (2026-07-30): "titlebar的高度过高，适当压缩到合理的高度。"
 * Owner correction (2026-07-30): follow skill-creator-v2 horizontal window-controls safe-area behavior.
 * Owner correction (2026-07-31): clicking the App brand expands or collapses the desktop sidebar.
 * Owner correction (2026-07-31): "使用VT的话，首先要把transform动画关闭。"
 * Owner correction (2026-07-31): sidebar snapshots align left, shell snapshots align right, and old/new use mask-image.
 * Owner correction (2026-07-31): shell old/new add a right-anchored scale-x handoff on top of the mask exchange.
 * Owner correction (2026-07-31): all four left/right old/new mask pairs must share the intended edge and overlap without a blank frame.
 * Owner acceptance boundary (2026-07-20): This is component evidence, not final OpenTray walkthrough.
 */
import { TerminalTabs } from '@openspecui/web-src/components/terminal/terminal-tabs'
import '@testing-library/jest-dom/vitest'
import { cleanup, render } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import '../index.css'
import { runSidebarViewTransition } from '../lib/sidebar-view-transition'
import { AppTitlebar } from './app-titlebar'

afterEach(async () => {
  cleanup()
  document.documentElement.style.removeProperty('--app-titlebar-left')
  document.documentElement.style.removeProperty('--app-titlebar-right')
  delete document.documentElement.dataset.sidebarVt
  await page.viewport(1280, 720)
})

function SidebarViewTransitionHarness() {
  const [collapsed, setCollapsed] = useState(false)
  const toggleSidebar = () => {
    runSidebarViewTransition({
      direction: collapsed ? 'expand' : 'collapse',
      update: () => setCollapsed((value) => !value),
    })
  }

  return (
    <div
      className="flex h-dvh min-h-0 w-full flex-col overflow-hidden"
      data-titlebar-presentation="opentray"
      data-testid="sidebar-vt-harness"
    >
      <AppTitlebar
        onSettings={() => {}}
        onToggleSidebar={toggleSidebar}
        onPointerDown={() => {}}
        presentation={{ kind: 'opentray', insets: { left: 0, right: 0, top: 0, height: 32 } }}
        settingsActive={false}
        sidebarCollapsed={collapsed}
        theme="system"
        resolvedTheme="light"
        onToggleTheme={() => {}}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <aside
          className={`shrink-0 overflow-hidden ${collapsed ? 'w-14 p-2' : 'w-56 p-3'}`}
          data-app-sidebar
          data-sidebar-collapsed={collapsed ? 'true' : 'false'}
        >
          Workspace navigation
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden" data-app-shell-content>
          Workspace content
        </main>
      </div>
    </div>
  )
}

describe('AppTitlebar browser boundary', () => {
  it('keeps a visible self-drawn OpenTray titlebar above Workspace tabs at narrow width', async () => {
    await page.viewport(320, 720)
    document.documentElement.style.setProperty('--app-titlebar-left', '76px')
    document.documentElement.style.setProperty('--app-titlebar-right', '84px')
    const view = render(
      <main className="flex h-48 w-full min-w-0 flex-col overflow-hidden">
        <AppTitlebar
          onSettings={() => {}}
          onToggleSidebar={() => {}}
          onPointerDown={() => {}}
          presentation={{
            kind: 'opentray',
            insets: { left: 0, right: 180, top: 0, height: 32 },
          }}
          settingsActive={false}
          sidebarCollapsed={false}
          theme="system"
          resolvedTheme="light"
          onToggleTheme={() => {}}
        />
        <TerminalTabs
          className="min-h-0 flex-1"
          selectedTab="workspace"
          tabs={[
            {
              id: 'workspace',
              label: 'Workspace',
              content: <div>Workspace content</div>,
            },
          ]}
        />
      </main>
    )

    const titlebar = view.getByRole('banner', { name: 'Application titlebar' })
    const tabs = view.container.querySelector<HTMLElement>('.tabs-header')
    expect(tabs).not.toBeNull()
    expect(titlebar.compareDocumentPosition(tabs!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(titlebar.getBoundingClientRect().height).toBeGreaterThanOrEqual(32)
    expect(titlebar.getBoundingClientRect().height).toBeLessThanOrEqual(33)
    expect(getComputedStyle(titlebar).paddingLeft).toBe('76px')
    expect(getComputedStyle(titlebar).paddingRight).toBe('84px')
    expect(getComputedStyle(titlebar).borderBottomWidth).toBe('1px')
    expect(titlebar.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      tabs!.getBoundingClientRect().top
    )
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth)
  })

  it('keeps compact height when native geometry reports a taller control area', () => {
    document.documentElement.style.setProperty('--app-titlebar-left', '84px')
    document.documentElement.style.setProperty('--app-titlebar-right', '124px')
    const view = render(
      <AppTitlebar
        onSettings={() => {}}
        onToggleSidebar={() => {}}
        onPointerDown={() => {}}
        presentation={{
          kind: 'opentray',
          insets: { left: 72, right: 80, top: 0, height: 44 },
        }}
        settingsActive={false}
        sidebarCollapsed={false}
        theme="system"
        resolvedTheme="light"
        onToggleTheme={() => {}}
      />
    )

    const titlebar = view.getByRole('banner', { name: 'Application titlebar' })
    expect(titlebar.getBoundingClientRect().height).toBe(32)
    expect(getComputedStyle(titlebar).paddingLeft).toBe('84px')
    expect(getComputedStyle(titlebar).paddingRight).toBe('124px')
  })

  it('runs equal-height edge-aligned mask transitions in both sidebar directions', async () => {
    expect(typeof document.startViewTransition).toBe('function')
    const nativeStartViewTransition = document.startViewTransition.bind(document)
    const startedTransitions: ViewTransition[] = []
    const startViewTransition = vi
      .spyOn(document, 'startViewTransition')
      .mockImplementation((callbackOptions) => {
        const transition = nativeStartViewTransition(callbackOptions)
        startedTransitions.push(transition)
        return transition
      })
    const view = render(<SidebarViewTransitionHarness />)
    const harness = view.getByTestId('sidebar-vt-harness')
    const sidebar = view.container.querySelector<HTMLElement>('[data-app-sidebar]')
    const brand = view.getByRole('button', { name: 'Collapse sidebar' })

    expect(sidebar).not.toBeNull()
    if (!sidebar) throw new Error('Expected the sidebar transition fixture to render.')
    expect(getComputedStyle(sidebar).transitionDuration).toBe('0s')
    brand.click()

    expect(startViewTransition).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.sidebarVt).toBe('collapse')
    await vi.waitFor(() => expect(startedTransitions).toHaveLength(1))
    const collapseTransition = startedTransitions[0]
    if (!collapseTransition) throw new Error('Expected the collapse View Transition.')
    await collapseTransition.ready
    const namedAnimations = document.getAnimations().filter((animation) => {
      const effect = animation.effect
      return (
        effect instanceof KeyframeEffect &&
        (effect.pseudoElement?.includes('app-sidebar') === true ||
          effect.pseudoElement?.includes('app-shell-content') === true)
      )
    })
    expect(namedAnimations.length).toBeGreaterThanOrEqual(4)
    const animationPropertyValues = (
      animations: Animation[],
      pseudoElement: string,
      propertyPattern: string
    ) =>
      animations
        .filter((candidate) => {
          const effect = candidate.effect
          return effect instanceof KeyframeEffect && effect.pseudoElement === pseudoElement
        })
        .flatMap((animation) => {
          const effect = animation.effect
          return effect instanceof KeyframeEffect ? effect.getKeyframes() : []
        })
        .flatMap((frame) =>
          Object.entries(frame).flatMap(([property, value]) =>
            property.toLowerCase().includes(propertyPattern) && typeof value === 'string'
              ? [value]
              : []
          )
        )
    expect(
      animationPropertyValues(
        namedAnimations,
        '::view-transition-old(app-sidebar)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['0%', '100%']))
    expect(
      animationPropertyValues(
        namedAnimations,
        '::view-transition-new(app-sidebar)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['70%', '0%']))
    expect(
      animationPropertyValues(
        namedAnimations,
        '::view-transition-old(app-shell-content)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['0%', '100%']))
    expect(
      animationPropertyValues(
        namedAnimations,
        '::view-transition-new(app-shell-content)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['30%', '100%']))
    expect(
      animationPropertyValues(namedAnimations, '::view-transition-old(app-shell-content)', 'scale')
    ).toEqual(expect.arrayContaining(['1', '1.04 1']))
    expect(
      animationPropertyValues(namedAnimations, '::view-transition-new(app-shell-content)', 'scale')
    ).toEqual(expect.arrayContaining(['0.96 1', '1']))
    for (const animation of namedAnimations) {
      const effect = animation.effect
      if (!(effect instanceof KeyframeEffect)) continue
      for (const frame of effect.getKeyframes()) {
        expect(frame.transform === undefined || frame.transform === 'none').toBe(true)
      }
    }
    const sidebarGroup = getComputedStyle(
      document.documentElement,
      '::view-transition-group(app-sidebar)'
    )
    const shellGroup = getComputedStyle(
      document.documentElement,
      '::view-transition-group(app-shell-content)'
    )
    const sidebarOld = getComputedStyle(
      document.documentElement,
      '::view-transition-old(app-sidebar)'
    )
    const shellOld = getComputedStyle(
      document.documentElement,
      '::view-transition-old(app-shell-content)'
    )
    const sidebarNew = getComputedStyle(
      document.documentElement,
      '::view-transition-new(app-sidebar)'
    )
    const shellNew = getComputedStyle(
      document.documentElement,
      '::view-transition-new(app-shell-content)'
    )
    expect(sidebarGroup.left).toBe('0px')
    expect(sidebarGroup.top).toBe('32px')
    expect(sidebarGroup.width).toBe('224px')
    expect(sidebarGroup.height).toBe('688px')
    expect(sidebarGroup.transform).toBe('none')
    expect(shellGroup.right).toBe('0px')
    expect(shellGroup.top).toBe('32px')
    expect(shellGroup.width).toBe('1224px')
    expect(shellGroup.height).toBe('688px')
    expect(shellGroup.transform).toBe('none')
    expect(sidebarOld.objectPosition).toBe('0% 0%')
    expect(shellOld.objectPosition).toBe('100% 0%')
    expect(sidebarOld.maskImage).toContain('rgb(0, 0, 0) 0%')
    expect(sidebarNew.maskImage).toContain('rgb(0, 0, 0) 0%')
    expect(shellOld.maskImage).toContain('rgb(0, 0, 0) 0%')
    expect(shellNew.maskImage).toContain('rgba(0, 0, 0, 0) 0%')
    expect(harness.scrollWidth).toBeLessThanOrEqual(harness.clientWidth)
    expect(harness.scrollHeight).toBeLessThanOrEqual(harness.clientHeight)

    await collapseTransition.finished
    expect(sidebar?.dataset.sidebarCollapsed).toBe('true')
    await vi.waitFor(() => expect(document.documentElement.dataset.sidebarVt).toBeUndefined())

    const expandBrand = view.getByRole('button', { name: 'Expand sidebar' })
    expandBrand.click()
    expect(document.documentElement.dataset.sidebarVt).toBe('expand')
    await vi.waitFor(() => expect(startedTransitions).toHaveLength(2))
    const expandTransition = startedTransitions[1]
    if (!expandTransition) throw new Error('Expected the expand View Transition.')
    await expandTransition.ready
    const expandAnimations = document.getAnimations().filter((animation) => {
      const effect = animation.effect
      return (
        effect instanceof KeyframeEffect &&
        (effect.pseudoElement?.includes('app-sidebar') === true ||
          effect.pseudoElement?.includes('app-shell-content') === true)
      )
    })
    expect(
      animationPropertyValues(
        expandAnimations,
        '::view-transition-old(app-sidebar)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['100%', '0%']))
    expect(
      animationPropertyValues(
        expandAnimations,
        '::view-transition-new(app-sidebar)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['70%', '0%']))
    expect(
      animationPropertyValues(
        expandAnimations,
        '::view-transition-old(app-shell-content)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['100%', '0%']))
    expect(
      animationPropertyValues(
        expandAnimations,
        '::view-transition-new(app-shell-content)',
        'maskpositionx'
      )
    ).toEqual(expect.arrayContaining(['30%', '100%']))
    expect(
      animationPropertyValues(expandAnimations, '::view-transition-old(app-shell-content)', 'scale')
    ).toEqual(expect.arrayContaining(['1', '0.96 1']))
    expect(
      animationPropertyValues(expandAnimations, '::view-transition-new(app-shell-content)', 'scale')
    ).toEqual(expect.arrayContaining(['1.04 1', '1']))
    const expandSidebarOld = getComputedStyle(
      document.documentElement,
      '::view-transition-old(app-sidebar)'
    )
    const expandSidebarNew = getComputedStyle(
      document.documentElement,
      '::view-transition-new(app-sidebar)'
    )
    const expandShellOld = getComputedStyle(
      document.documentElement,
      '::view-transition-old(app-shell-content)'
    )
    const expandShellNew = getComputedStyle(
      document.documentElement,
      '::view-transition-new(app-shell-content)'
    )
    expect(expandSidebarOld.maskImage).toContain('rgba(0, 0, 0, 0) 0%')
    expect(expandSidebarNew.maskImage).toContain('rgb(0, 0, 0) 0%')
    expect(expandShellOld.maskImage).toContain('rgba(0, 0, 0, 0) 0%')
    expect(expandShellNew.maskImage).toContain('rgba(0, 0, 0, 0) 0%')
    await expandTransition.finished
    expect(sidebar.dataset.sidebarCollapsed).toBe('false')
    await vi.waitFor(() => expect(document.documentElement.dataset.sidebarVt).toBeUndefined())
    expect(harness.scrollWidth).toBeLessThanOrEqual(harness.clientWidth)
    expect(harness.scrollHeight).toBeLessThanOrEqual(harness.clientHeight)
  })
})
