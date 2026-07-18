/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Lock the project navigation source to supported top-level routes and default areas.
 * 2. Prove Context replaces Stores in desktop and mobile navigation.
 *
 * Original request (2026-07-18): "replace the project WebUI Stores route with the canonical Context surface."
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

  it('registers Context and removes Stores from desktop and mobile navigation', () => {
    expect(allNavItems.find((item) => item.to === '/context')).toMatchObject({
      label: 'Context',
      defaultArea: 'main',
    })
    expect(navItems.some((item) => item.to === '/context')).toBe(true)
    expect(mobileNavItems.some((item) => item.to === '/context')).toBe(true)
    expect(allNavItems.some((item) => item.to === '/stores')).toBe(false)
    expect(navItems.some((item) => item.to === '/stores')).toBe(false)
    expect(mobileNavItems.some((item) => item.to === '/stores')).toBe(false)
  })
})
