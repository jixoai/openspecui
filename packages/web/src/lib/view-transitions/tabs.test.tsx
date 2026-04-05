import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect, useMemo } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useRoutedCarouselTabs } from './tabs'

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => true,
}))

vi.mock('./runtime', () => ({
  runViewTransition: ({ update }: { update: () => void }) => {
    update()
    return Promise.resolve()
  },
}))

function RoutedTabsResetHarness() {
  const tabs = useMemo(
    () =>
      [{ id: 'diff' as const }, { id: 'files' as const }] satisfies Array<{ id: 'diff' | 'files' }>,
    []
  )
  const { selectedTab, setSelectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: 'gitPane',
    tabs,
    initialTab: 'diff',
  })

  useEffect(() => {
    setSelectedTab('diff')
  }, [setSelectedTab])

  return (
    <div>
      <div data-testid="selected-tab">{selectedTab}</div>
      <button type="button" onClick={() => onTabChange('files')}>
        Show files
      </button>
    </div>
  )
}

describe('useRoutedCarouselTabs', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/git/commit/abc12345?gitPane=diff')
  })

  it('keeps tab selection when caller effects depend on setSelectedTab identity', async () => {
    render(<RoutedTabsResetHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Show files' }))

    await waitFor(() => {
      expect(screen.getByTestId('selected-tab').textContent).toBe('files')
    })

    expect(window.location.search).toBe('?gitPane=files')
  })
})
