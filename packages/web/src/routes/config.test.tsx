/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Verify Config overview navigation is route-backed, self-describing, and narrow-safe.
 * 2. Verify all six owner summaries retain real-card geometry and promote failures directly.
 * 3. Verify Context and the live adaptive Guide remain in the overview title action plane.
 * 4. Verify static overview starts no Project, Environment, Agent, or live Context owner.
 *
 * Owner Config-workbench decision (2026-08-01): fixed owners and Schema entities must not share a horizontal tab strip.
 * Owner Config-Guide decision (2026-08-01): keep Guide in the Config title action plane.
 * Original request (2026-08-01): "我希望在Config页面加一个 `Guide` 的按钮，点击后使用js引导库来引导用户完成相关的openspec项目配置。"
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from './config'

const {
  activeRootMock,
  agentIntegrationsMock,
  configBundleMock,
  environmentMock,
  guideMock,
  guideStartMock,
  isStaticModeMock,
  projectBindingMock,
  rootActionMock,
} = vi.hoisted(() => ({
  activeRootMock: vi.fn(),
  agentIntegrationsMock: vi.fn(),
  configBundleMock: vi.fn(),
  environmentMock: vi.fn(),
  guideMock: vi.fn(),
  guideStartMock: vi.fn(),
  isStaticModeMock: vi.fn(),
  projectBindingMock: vi.fn(),
  rootActionMock: vi.fn(),
}))

vi.mock('@/components/config/config-guide', () => ({
  useConfigGuide: guideMock,
}))

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

vi.mock('@/lib/use-agent-integrations', () => ({
  useAgentIntegrations: agentIntegrationsMock,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: configBundleMock,
}))

vi.mock('@/lib/use-planning-config', () => ({
  useActiveRootConfigViewSubscription: activeRootMock,
  useEnvironmentGlobalConfigSubscription: environmentMock,
  useProjectBindingSubscription: projectBindingMock,
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))

describe('Config overview workbench', () => {
  beforeEach(() => {
    isStaticModeMock.mockReturnValue(false)
    guideMock.mockReturnValue({
      canStart: true,
      active: false,
      start: guideStartMock,
      restart: vi.fn(),
      cancel: vi.fn(),
      register: vi.fn(),
    })
    projectBindingMock.mockReturnValue({
      data: {
        binding: {
          store: { state: 'declared', id: 'team' },
          references: { state: 'declared', entries: [{ id: 'shared' }] },
        },
      },
      isLoading: false,
      error: null,
    })
    activeRootMock.mockReturnValue({
      data: {
        content: 'schema: spec-driven',
        exists: true,
        filePath: '/project/openspec/config.yaml',
        owner: null,
      },
      isLoading: false,
      error: null,
    })
    environmentMock.mockReturnValue({
      data: { configPath: '/runtime/openspec/config.json' },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
    })
    agentIntegrationsMock.mockReturnValue({
      data: {
        registry: [{ value: 'claude' }, { value: 'codex' }],
        states: [
          { issues: [] },
          { issues: [{ code: 'cleanup-needed', message: 'Legacy prompt remains.' }] },
        ],
      },
      error: null,
      isLoading: false,
      isRefreshing: false,
    })
    configBundleMock.mockReturnValue({
      data: {
        schemas: [
          {
            name: 'spec-driven',
            description: 'Default workflow',
            artifacts: [],
            source: 'package',
          },
        ],
        schemaDetails: {},
        schemaResolutions: {},
      },
      isLoading: false,
      error: null,
    })
    rootActionMock.mockReturnValue({
      status: 'ready',
      disabled: false,
      context: {
        planningRoot: { path: '/project/openspec', source: 'nearest' },
      },
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a narrow-safe self-describing route workbench without dynamic Schema tabs', () => {
    const { container } = render(<Config />)

    const workbench = screen.getByTestId('config-workbench')
    expect(workbench).toHaveClass('overflow-x-clip')
    expect(workbench).not.toHaveClass('overflow-y-auto')
    expect(container.querySelectorAll('[data-config-page-scroll-owner="true"]')).toHaveLength(0)

    const navigation = screen.getByRole('navigation', { name: 'Config sections' })
    for (const [name, href] of [
      ['Overview', '/config'],
      ['Project Binding', '/config/project'],
      ['Active Root', '/config/root'],
      ['Environment', '/config/environment'],
      ['Agents', '/config/agents'],
      ['Schemas', '/config/schemas'],
      ['Context', '/config/context'],
    ]) {
      expect(within(navigation).getByRole('link', { name })).toHaveAttribute('href', href)
    }
    expect(navigation).not.toHaveClass('overflow-x-auto')
    expect(container.querySelector('[data-dynamic-schema-tab]')).toBeNull()
    expect(screen.queryByRole('button', { name: /Schema\(/ })).toBeNull()
  })

  it('summarizes every owner and keeps Context plus Guide in the title action plane', () => {
    render(<Config />)

    for (const name of [
      'Project Binding',
      'Active Root',
      'Environment',
      'Agent Delivery',
      'Schemas',
      'Resolved Context',
    ]) {
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
    }
    const guideAction = screen.getByRole('button', { name: 'Guide' })
    expect(guideAction).toBeEnabled()
    expect(guideAction).toHaveAttribute('id', 'config-guide-overview-action')
    fireEvent.click(guideAction)
    expect(guideStartMock).toHaveBeenCalledOnce()
    expect(screen.getByRole('link', { name: 'Open Resolved Context' })).toHaveAttribute(
      'href',
      '/config/context'
    )
    expect(screen.getByText('declared Store · 1 References')).toBeTruthy()
    expect(screen.getByText('2 Agents · 1 with issues')).toBeTruthy()
    expect(screen.getByText('1 resolved Schemas')).toBeTruthy()
  })

  it('promotes subscription failures without replacing owner card geometry', () => {
    projectBindingMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Project Binding transport failed.'),
    })
    configBundleMock.mockReturnValue({
      data: {
        schemas: [
          {
            name: 'retained-schema',
            description: 'Retained',
            artifacts: [],
            source: 'project',
          },
        ],
        schemaDetails: {},
        schemaResolutions: {},
      },
      isLoading: false,
      error: new Error('Schema refresh failed.'),
    })
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 1,
      title: 'Planning root unavailable',
      message: 'Root Context failed.',
      evidence: [],
    })

    render(<Config />)

    expect(screen.getAllByRole('link', { name: 'Project Binding' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('link', { name: 'Schemas' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Resolved Context' })).toBeTruthy()
    expect(
      screen.getByText('Project Binding transport failed.').closest('[role="alert"]')
    ).not.toBeNull()
    expect(screen.getByText('Schema refresh failed.').closest('[role="alert"]')).not.toBeNull()
    expect(screen.getByText('Root Context failed.').closest('[role="alert"]')).not.toBeNull()
  })

  it('keeps live-only owners out of static navigation and starts no live-only owner', () => {
    isStaticModeMock.mockReturnValue(true)
    guideMock.mockReturnValue(null)
    render(<Config />)

    const navigation = screen.getByRole('navigation', { name: 'Config sections' })
    expect(within(navigation).queryByRole('link', { name: 'Project Binding' })).toBeNull()
    expect(within(navigation).queryByRole('link', { name: 'Environment' })).toBeNull()
    expect(within(navigation).queryByRole('link', { name: 'Agents' })).toBeNull()
    expect(within(navigation).getByRole('link', { name: 'Active Root' })).toHaveAttribute(
      'href',
      '/config/root'
    )
    expect(within(navigation).getByRole('link', { name: 'Schemas' })).toHaveAttribute(
      'href',
      '/config/schemas'
    )
    expect(within(navigation).getByRole('link', { name: 'Context' })).toHaveAttribute(
      'href',
      '/config/context'
    )
    expect(projectBindingMock).not.toHaveBeenCalled()
    expect(environmentMock).not.toHaveBeenCalled()
    expect(agentIntegrationsMock).not.toHaveBeenCalled()
    expect(rootActionMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Guide' })).toBeNull()
    expect(screen.getAllByText('Not published')).toHaveLength(3)
  })
})
