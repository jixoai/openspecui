import { describe, expect, it } from 'vitest'
import { allNavItems, navItems } from './nav-items'

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
})
