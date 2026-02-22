import { createEvent, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AreaNav } from './area-nav'

const { navControllerMock } = vi.hoisted(() => ({
  navControllerMock: {
    moveTab: vi.fn(),
    reorder: vi.fn(),
    activateBottom: vi.fn(),
    deactivateBottom: vi.fn(),
    mainTabs: ['/dashboard', '/config', '/specs', '/changes', '/archive', '/settings'],
    bottomTabs: ['/terminal'],
  },
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: navControllerMock,
}))

vi.mock('@/lib/use-nav-controller', () => ({
  useNavLayout: () => ({
    mainTabs: ['/dashboard', '/config', '/specs', '/changes', '/archive', '/settings'],
    bottomTabs: ['/terminal'],
    mainLocation: {
      href: '/dashboard',
      pathname: '/dashboard',
      search: '',
      hash: '',
      state: { __TSR_index: 0, key: 'main', __TSR_key: 'main' },
    },
    bottomLocation: {
      href: '/terminal',
      pathname: '/terminal',
      search: '',
      hash: '',
      state: { __TSR_index: 0, key: 'bottom', __TSR_key: 'bottom' },
    },
    bottomActive: true,
  }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    to,
    children,
    ...props
  }: { to: string; children?: ReactNode } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

describe('AreaNav drag behavior', () => {
  it('keeps main links non-draggable while list items remain draggable', () => {
    const { container } = render(<AreaNav area="main" tabs={['/dashboard', '/config']} />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link.getAttribute('draggable')).toBe('false')
    }

    const listItems = container.querySelectorAll('li')
    expect(listItems).toHaveLength(2)
    for (const li of listItems) {
      expect(li.getAttribute('draggable')).toBe('true')
    }
  })

  it('prevents native dragstart on main link elements', () => {
    const { container } = render(<AreaNav area="main" tabs={['/dashboard']} />)

    const link = within(container).getByRole('link', { name: 'Dashboard' })
    const dragStart = createEvent.dragStart(link)

    fireEvent(link, dragStart)

    expect(dragStart.defaultPrevented).toBe(true)
  })
})
