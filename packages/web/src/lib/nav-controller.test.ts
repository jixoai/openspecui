import type { RouterHistory } from '@tanstack/react-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('./static-mode', () => ({ isStaticMode: () => false }))
vi.mock('./trpc', () => ({
  trpcClient: {
    kv: {
      get: { query: vi.fn().mockResolvedValue(null) },
      set: { mutate: vi.fn().mockResolvedValue(null) },
      subscribe: { subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }) },
    },
  },
}))

import { NavController, navController, type NavLayout, type TabId } from './nav-controller'

const DEFAULT_MAIN_TABS: TabId[] = [
  '/dashboard',
  '/config',
  '/specs',
  '/changes',
  '/archive',
  '/settings',
]

const ALL_TABS: TabId[] = [
  '/dashboard',
  '/config',
  '/specs',
  '/changes',
  '/archive',
  '/settings',
  '/terminal',
]

function createController(url: string, layout?: NavLayout): NavController {
  localStorage.clear()

  if (layout) {
    localStorage.setItem(
      'nav-layout',
      JSON.stringify({
        mainTabs: layout.mainTabs,
        bottomTabs: layout.bottomTabs,
        updatedAt: 1,
      })
    )
  }

  window.history.replaceState({}, '', url)
  return new NavController()
}

function assertPartition(nav: NavController): void {
  const allPlaced = [...nav.mainTabs, ...nav.bottomTabs]
  expect(allPlaced.length).toBe(ALL_TABS.length)
  expect(new Set(allPlaced).size).toBe(ALL_TABS.length)
  for (const tab of ALL_TABS) {
    expect(allPlaced).toContain(tab)
  }
}

function mockHistory(
  notify: (event: { type: 'PUSH' | 'REPLACE' | 'BACK' }) => void
): RouterHistory {
  return { notify } as unknown as RouterHistory
}

beforeAll(() => {
  navController.destroy()
})

describe('NavController kernel lifecycle', () => {
  let nav: NavController

  afterEach(() => {
    nav.destroy()
  })

  it('bootstraps from URL and writes canonical _b mapping', () => {
    nav = createController('/dashboard')

    expect([...nav.mainTabs]).toEqual(DEFAULT_MAIN_TABS)
    expect([...nav.bottomTabs]).toEqual(['/terminal'])
    expect(nav.getLocation('main').pathname).toBe('/dashboard')
    expect(nav.getLocation('bottom').pathname).toBe('/')
    expect(window.location.search).toContain('_b=%2F')
    assertPartition(nav)
  })

  it('getAreaForPath strictly follows current tab mapping', () => {
    nav = createController('/dashboard')

    expect(nav.getAreaForPath('/changes')).toBe('main')
    nav.moveTab('/changes', 'bottom')
    expect(nav.getAreaForPath('/changes')).toBe('bottom')
    expect(nav.getAreaForPath('/changes/123')).toBe('bottom')
    expect(nav.getAreaForPath('/unknown')).toBe('main')
  })

  it('routes push to the owning area and notifies cross-area router', () => {
    nav = createController('/dashboard')
    const bottomNotify = vi.fn()
    nav.setHistoryRef('bottom', mockHistory(bottomNotify))

    nav.push('main', '/terminal', { source: 'main' })

    expect(nav.getLocation('main').pathname).toBe('/dashboard')
    expect(nav.getLocation('bottom').pathname).toBe('/terminal')
    expect(bottomNotify).toHaveBeenCalledWith({ type: 'PUSH' })
    expect(window.location.search).toContain('_b=%2Fterminal')
  })

  it('activatePop writes _p and deactivatePop removes it', () => {
    nav = createController('/dashboard')

    nav.activatePop('/search?query=auth')
    expect(nav.getLocation('pop').pathname).toBe('/search')
    expect(window.location.search).toContain('_p=%2Fsearch%3Fquery%3Dauth')

    nav.deactivatePop()
    expect(nav.getLocation('pop').pathname).toBe('/')
    expect(window.location.search).not.toContain('_p=')
  })

  it('treats /opsx-new as pop-area route', () => {
    nav = createController('/dashboard')

    nav.activatePop('/opsx-new')

    expect(nav.getLocation('pop').pathname).toBe('/opsx-new')
    expect(nav.getAreaForPath('/opsx-new')).toBe('pop')
    expect(window.location.search).toContain('_p=%2Fopsx-new')
  })

  it('treats /opsx-compose as pop-area route', () => {
    nav = createController('/dashboard')

    nav.activatePop('/opsx-compose?action=archive&change=demo')

    expect(nav.getLocation('pop').pathname).toBe('/opsx-compose')
    expect(nav.getAreaForPath('/opsx-compose')).toBe('pop')
    expect(window.location.search).toContain(
      '_p=%2Fopsx-compose%3Faction%3Darchive%26change%3Ddemo'
    )
  })

  it('treats /opsx-propose and /opsx-verify as pop-area routes', () => {
    nav = createController('/dashboard')

    nav.activatePop('/opsx-propose')
    expect(nav.getAreaForPath('/opsx-propose')).toBe('pop')
    expect(nav.getLocation('pop').pathname).toBe('/opsx-propose')

    nav.activatePop('/opsx-verify?change=demo')
    expect(nav.getAreaForPath('/opsx-verify')).toBe('pop')
    expect(nav.getLocation('pop').pathname).toBe('/opsx-verify')
  })

  it('routes pop-area navigation within pop router', () => {
    nav = createController('/dashboard')
    const popNotify = vi.fn()
    nav.setHistoryRef('pop', mockHistory(popNotify))

    nav.push('pop', '/search?query=term', { source: 'pop' })

    expect(nav.getLocation('main').pathname).toBe('/dashboard')
    expect(nav.getLocation('pop').pathname).toBe('/search')
    expect(popNotify).toHaveBeenCalledWith({ type: 'REPLACE' })
  })

  it('routes replace to main when bottom router navigates to a main tab', () => {
    nav = createController('/dashboard?_b=%2Fterminal')
    const mainNotify = vi.fn()
    nav.setHistoryRef('main', mockHistory(mainNotify))

    nav.replace('bottom', '/settings', { source: 'bottom' })

    expect(nav.getLocation('main').pathname).toBe('/settings')
    expect(nav.getLocation('bottom').pathname).toBe('/terminal')
    expect(mainNotify).toHaveBeenCalledWith({ type: 'REPLACE' })
  })

  it('moveTab keeps moved active item active in bottom and auto-activates first main tab', () => {
    nav = createController('/changes')

    nav.moveTab('/changes', 'bottom')

    expect(nav.getLocation('main').pathname).toBe('/dashboard')
    expect(nav.getLocation('bottom').pathname).toBe('/changes')
    expect(window.location.pathname).toBe('/dashboard')
    expect(window.location.search).toContain('_b=%2Fchanges')
    assertPartition(nav)
  })

  it('moveTab keeps moved active item active in main when dragging from bottom', () => {
    nav = createController('/settings?_b=%2Fterminal')

    nav.moveTab('/terminal', 'main')

    expect(nav.getLocation('main').pathname).toBe('/terminal')
    expect(nav.getLocation('bottom').pathname).toBe('/')
    expect(nav.bottomTabs).toHaveLength(0)
    expect(window.location.pathname).toBe('/terminal')
    expect(window.location.search).toBe('')
  })

  it('auto-activates first main tab when main has no active item', () => {
    nav = createController('/?_b=%2Fterminal')

    expect(nav.getLocation('main').pathname).toBe('/dashboard')
    expect(nav.getLocation('bottom').pathname).toBe('/terminal')
  })

  it('auto-activates new first main tab when active main tab moves to bottom', () => {
    nav = createController('/dashboard')

    nav.moveTab('/dashboard', 'bottom')

    expect(nav.getLocation('main').pathname).toBe('/config')
    expect(nav.getLocation('bottom').pathname).toBe('/dashboard')
  })

  it('closeTab deactivates active bottom tab without changing nav ownership', () => {
    nav = createController('/settings')
    nav.moveTab('/changes', 'bottom')
    nav.activateBottom('/changes')

    nav.closeTab('/changes')

    expect(nav.mainTabs).not.toContain('/changes')
    expect(nav.bottomTabs).toContain('/changes')
    expect(nav.getLocation('main').pathname).toBe('/settings')
    expect(nav.getLocation('bottom').pathname).toBe('/')
  })

  it('activateBottom ignores paths that are not owned by bottom area', () => {
    nav = createController('/dashboard')
    const before = nav.getLocation('bottom').href

    nav.activateBottom('/settings')

    expect(nav.getLocation('bottom').href).toBe(before)
  })

  it('deactivateBottom keeps explicit no-focus marker in URL', () => {
    nav = createController('/dashboard?_b=%2Fterminal')

    nav.deactivateBottom()

    expect(nav.getLocation('bottom').pathname).toBe('/')
    expect(window.location.search).toContain('_b=%2F')
  })

  it('parses invalid _b as bottom no-focus', () => {
    nav = createController('/dashboard?_b=%2Fsettings')

    expect(nav.getLocation('bottom').pathname).toBe('/')
    expect(window.location.search).toContain('_b=%2F')
  })

  it('parses missing _b and normalizes to canonical mapping', () => {
    nav = createController('/specs')

    expect(nav.getLocation('main').pathname).toBe('/specs')
    expect(nav.getLocation('bottom').pathname).toBe('/')
    expect(window.location.search).toContain('_b=%2F')
  })

  it('activates first main tab when URL points to a tab currently owned by bottom', () => {
    nav = createController('/changes?_b=%2Fterminal', {
      mainTabs: ['/dashboard', '/config', '/specs', '/archive', '/settings'],
      bottomTabs: ['/terminal', '/changes'],
    })

    expect(nav.getLocation('main').pathname).toBe('/dashboard')
    expect(nav.getLocation('bottom').pathname).toBe('/terminal')
  })

  it('popstate reparses URL and notifies both router histories', () => {
    nav = createController('/dashboard')
    const mainNotify = vi.fn()
    const bottomNotify = vi.fn()
    const popNotify = vi.fn()

    nav.setHistoryRef('main', mockHistory(mainNotify))
    nav.setHistoryRef('bottom', mockHistory(bottomNotify))
    nav.setHistoryRef('pop', mockHistory(popNotify))

    window.history.replaceState(
      { main: { from: 'pop' }, bottom: { from: 'pop' }, pop: { from: 'pop' } },
      '',
      '/specs?_b=%2Fterminal&_p=%2Fsearch%3Fquery%3Dauth'
    )
    window.dispatchEvent(new PopStateEvent('popstate'))

    expect(nav.getLocation('main').pathname).toBe('/specs')
    expect(nav.getLocation('bottom').pathname).toBe('/terminal')
    expect(nav.getLocation('pop').pathname).toBe('/search')
    expect(mainNotify).toHaveBeenCalledWith({ type: 'BACK' })
    expect(bottomNotify).toHaveBeenCalledWith({ type: 'BACK' })
    expect(popNotify).toHaveBeenCalledWith({ type: 'BACK' })
  })

  it('reorder persists layout and preserves tab partition', () => {
    nav = createController('/dashboard')

    nav.reorder('main', ['/specs', '/dashboard', '/config'])

    expect(nav.mainTabs.slice(0, 3)).toEqual(['/specs', '/dashboard', '/config'])
    const raw = localStorage.getItem('nav-layout')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!) as { mainTabs: TabId[]; updatedAt: number }
    expect(parsed.mainTabs[0]).toBe('/specs')
    expect(typeof parsed.updatedAt).toBe('number')
    assertPartition(nav)
  })
})
