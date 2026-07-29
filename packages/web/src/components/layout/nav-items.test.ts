/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Lock the project navigation source to supported top-level routes and default areas.
 * 2. Prove Stores and Config-owned Resolved Context stay out of persistent navigation.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Owner Context direction (2026-07-29): Context is a Config action rather than a desktop/mobile tab.
 */
import { describe, expect, it } from 'vitest'
import { allNavItems, mobileNavItems, navItems } from './nav-items'

describe('navItems', () => {
  it('includes Config and excludes Project', () => {
    const hasConfig = navItems.some((item) => item.to === '/config' && item.label === 'Config')
    const hasProject = navItems.some((item) => item.to === '/project' || item.label === 'Project')

    expect(hasConfig).toBe(true)
    expect(hasProject).toBe(false)
  })

  it('places Git in the bottom area by default without adding it to main nav', () => {
    expect(allNavItems.find((item) => item.to === '/git')).toMatchObject({
      label: 'Git',
      defaultArea: 'bottom',
    })
    expect(navItems.some((item) => item.to === '/git')).toBe(false)
  })

  it('keeps Stores and Resolved Context out of desktop and mobile navigation', () => {
    expect(allNavItems.some((item) => item.to === '/context')).toBe(false)
    expect(navItems.some((item) => item.to === '/context')).toBe(false)
    expect(mobileNavItems.some((item) => item.to === '/context')).toBe(false)
    expect(allNavItems.some((item) => item.to === '/stores')).toBe(false)
    expect(navItems.some((item) => item.to === '/stores')).toBe(false)
    expect(mobileNavItems.some((item) => item.to === '/stores')).toBe(false)
  })
})
