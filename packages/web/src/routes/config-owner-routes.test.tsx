/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Verify Project, Active Root, and Environment routes mount only their declared production owner.
 * 2. Verify each owner route inherits Config-local navigation without creating a nested page-scroll owner.
 * 3. Verify only Active Root forwards static publication mode to its read-only owner.
 *
 * Owner Config-workbench decision (2026-08-01): move fixed Config owners into focused route modules.
 * Original request (2026-08-01): "还是说我们应该把它迁移到 config 页面下，毕竟 config 页面下有做二级页面的一个前例。"
 */
import { cleanup, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ConfigEnvironment } from './config-environment'
import { ConfigProject } from './config-project'
import { ConfigRoot } from './config-root'

const { isStaticModeMock } = vi.hoisted(() => ({ isStaticModeMock: vi.fn(() => false) }))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: isStaticModeMock,
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

vi.mock('@/components/config/project-binding-section', () => ({
  ProjectBindingSection: ({ isStatic }: { isStatic: boolean }) => (
    <div data-testid="project-binding-owner" data-static={String(isStatic)} />
  ),
}))

vi.mock('@/components/config/active-root-config-section', () => ({
  ActiveRootConfigSection: ({ isStatic }: { isStatic: boolean }) => (
    <div data-testid="active-root-owner" data-static={String(isStatic)} />
  ),
}))

vi.mock('@/components/config/environment-global-config-section', () => ({
  EnvironmentGlobalConfigSection: ({ isStatic }: { isStatic: boolean }) => (
    <div data-testid="environment-owner" data-static={String(isStatic)} />
  ),
}))

function expectRouteFrame(currentLabel: string) {
  expect(screen.getByTestId('config-workbench')).toBeTruthy()
  expect(document.querySelectorAll('[data-config-page-scroll-owner="true"]')).toHaveLength(0)
  const navigation = screen.getByRole('navigation', { name: 'Config sections' })
  expect(within(navigation).getByRole('link', { name: currentLabel })).toHaveAttribute(
    'aria-current',
    'page'
  )
  expect(screen.getByRole('link', { name: 'Back to Config' })).toHaveAttribute('href', '/config')
}

describe('focused Config owner routes', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    isStaticModeMock.mockReturnValue(false)
  })

  it('mounts only Project Binding on the project route', () => {
    render(<ConfigProject />)

    expectRouteFrame('Project Binding')
    expect(screen.getByTestId('project-binding-owner')).toHaveAttribute('data-static', 'false')
    expect(screen.queryByTestId('active-root-owner')).toBeNull()
    expect(screen.queryByTestId('environment-owner')).toBeNull()
  })

  it('mounts Active Root in live and static publication modes', () => {
    render(<ConfigRoot />)

    expectRouteFrame('Active Root')
    expect(screen.getByTestId('active-root-owner')).toHaveAttribute('data-static', 'false')

    cleanup()
    isStaticModeMock.mockReturnValue(true)
    render(<ConfigRoot />)
    expect(screen.getByTestId('active-root-owner')).toHaveAttribute('data-static', 'true')
  })

  it('mounts only Environment on the live environment route', () => {
    render(<ConfigEnvironment />)

    expectRouteFrame('Environment')
    expect(screen.getByTestId('environment-owner')).toHaveAttribute('data-static', 'false')
    expect(screen.queryByTestId('project-binding-owner')).toBeNull()
    expect(screen.queryByTestId('active-root-owner')).toBeNull()
  })
})
