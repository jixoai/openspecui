/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Verify Settings renders Agent policy and physical state as a read-only summary.
 * 2. Verify shared live replacement and stale-error projections remain readable.
 * 3. Verify Agent mutations and terminal ownership no longer exist in Settings.
 * 4. Verify configured, partial, drifted, failed, and unavailable counts remain source-distinct.
 * 5. Carry the command-surface unavailability field in fixtures.
 *
 * Original request (2026-08-01): Settings only shows Agent status and navigates management to `/config/agents`.
 * Owner acceptance boundary (2026-07-20): final end-to-end browser walkthroughs remain owner-owned.
 
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import type { AgentIntegrationsProjection } from '@/lib/use-agent-integrations'
import type { EnvironmentGlobalConfig, ToolInitState, ToolWorkflowId } from '@openspecui/core'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenSpecSettingsSections } from './openspec-settings-section'

const { environmentSubscriptionMock, useAgentIntegrationsMock } = vi.hoisted(() => ({
  environmentSubscriptionMock: vi.fn(),
  useAgentIntegrationsMock: vi.fn(),
}))

vi.mock('@/lib/use-planning-config', () => ({
  useEnvironmentGlobalConfigSubscription: environmentSubscriptionMock,
}))

vi.mock('@/lib/use-agent-integrations', () => ({
  useAgentIntegrations: useAgentIntegrationsMock,
}))

vi.mock('@/components/realtime', () => ({
  RealtimeSkeletonLine: ({ className }: { className?: string }) => (
    <div data-testid="skeleton-line" className={className} />
  ),
}))

vi.mock('@/components/toc', () => ({
  TocSection: ({ children, id }: { children: ReactNode; id: string }) => (
    <section id={id}>{children}</section>
  ),
}))

vi.mock('./openspec-settings-diagnostics', () => ({
  OpenSpecSettingsDiagnosticsSection: ({ index }: { index: number }) => (
    <section data-testid="diagnostics-section" data-index={index} />
  ),
}))

vi.mock('./settings-status-label', () => ({
  SettingsStatusLabel: ({ children, status }: { children: ReactNode; status: string }) => (
    <span data-status={status}>{children}</span>
  ),
}))

const WORKFLOWS = ['propose', 'apply', 'verify', 'archive'] satisfies ToolWorkflowId[]

function tool(value: string, available = true): AgentIntegrationsProjection['registry'][number] {
  return {
    name: value,
    value,
    available,
    skillsDir: available ? `.${value}` : null,
    capability: available ? 'adapter-backed' : 'none',
    command: null,
  }
}

function state(
  toolId: string,
  readiness: ToolInitState['readiness'],
  issues: ToolInitState['issues'] = []
): ToolInitState {
  return {
    toolId,
    toolName: toolId,
    status: issues[0] ?? readiness,
    readiness,
    issues,
    skillsScope:
      readiness === 'unavailable' ? { kind: 'none' } : { kind: 'project', skillsDir: `.${toolId}` },
    legacySkillRoots: [],
    requiresIdeRestart: false,
    commandSurfaceUnavailableReason: null,
    hasAnyArtifacts: readiness === 'partial' || readiness === 'initialized',
    expectedSkillCount: WORKFLOWS.length,
    presentExpectedSkillCount: readiness === 'initialized' ? WORKFLOWS.length : 0,
    detectedSkillCount: readiness === 'initialized' ? WORKFLOWS.length : 0,
    expectedCommandCount: WORKFLOWS.length,
    presentExpectedCommandCount: readiness === 'initialized' ? WORKFLOWS.length : 0,
    detectedCommandCount: readiness === 'initialized' ? WORKFLOWS.length : 0,
    missingSkillWorkflows: readiness === 'initialized' ? [] : [...WORKFLOWS],
    missingCommandWorkflows: readiness === 'initialized' ? [] : [...WORKFLOWS],
    unexpectedSkillWorkflows: [],
    unexpectedCommandWorkflows: [],
    legacyCommandWorkflows: [],
    installedSkillWorkflows: readiness === 'initialized' ? [...WORKFLOWS] : [],
    installedCommandWorkflows: readiness === 'initialized' ? [...WORKFLOWS] : [],
    generatedByVersion: readiness === 'initialized' ? '1.7.0' : null,
  }
}

function projection(
  overrides: Partial<AgentIntegrationsProjection> = {}
): AgentIntegrationsProjection {
  return {
    registry: [tool('claude'), tool('codex'), tool('cursor'), tool('kimi'), tool('agents', false)],
    policy: { profile: 'core', delivery: 'both', workflows: [...WORKFLOWS] },
    states: [
      state('claude', 'initialized'),
      state('codex', 'partial', ['stale-version', 'cleanup-needed']),
      state('cursor', 'uninitialized', ['migration-required']),
      state('kimi', 'uninitialized'),
      state('agents', 'unavailable'),
    ],
    ...overrides,
  }
}

function renderSections() {
  return render(<OpenSpecSettingsSections diagnosticsIndex={3} agentIntegrationsIndex={4} />)
}

describe('OpenSpecSettingsSections', () => {
  beforeEach(() => {
    environmentSubscriptionMock.mockReturnValue({
      data: null satisfies EnvironmentGlobalConfig | null,
      isLoading: false,
      refreshPending: false,
      error: null,
      refresh: vi.fn<() => Promise<void>>(),
    })
    useAgentIntegrationsMock.mockReturnValue({
      data: projection(),
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: vi.fn(),
      accept: vi.fn(),
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders a read-only Agent summary with Config-owned management navigation', () => {
    renderSections()

    expect(screen.getByTestId('diagnostics-section')).toHaveAttribute('data-index', '3')
    expect(screen.getByText('core profile · both')).toBeTruthy()

    expect(
      screen.getByText('4 workflows are delivered under the Environment Global Agent policy.')
    ).toBeTruthy()
    expect(screen.getByText('2 integrations need attention')).toHaveAttribute(
      'data-status',
      'partial'
    )
    expect(screen.getByText('Configured').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Partial').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Drifted').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Failed').nextElementSibling).toHaveTextContent('0')
    expect(screen.getByText('Unavailable').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('1 stale version')).toBeTruthy()
    expect(screen.getByText('1 cleanup needed')).toBeTruthy()
    expect(screen.getByText('1 migration required')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/config/agents')

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByLabelText('Init Mode')).toBeNull()
    expect(screen.queryByText('Cancel')).toBeNull()
  })

  it('renders replacement Agent projection updates from the shared live hook', () => {
    const view = renderSections()
    useAgentIntegrationsMock.mockReturnValue({
      data: projection({
        policy: { profile: 'custom', delivery: 'skills', workflows: ['apply'] },
        states: [
          state('claude', 'initialized'),
          state('codex', 'initialized'),
          state('cursor', 'initialized'),
          state('kimi', 'initialized'),
          state('agents', 'unavailable'),
        ],
      }),
      isLoading: false,
      isRefreshing: false,
      error: null,
      refresh: vi.fn(),
      accept: vi.fn(),
    })
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={3} agentIntegrationsIndex={4} />)

    expect(screen.getByText('custom profile · skills')).toBeTruthy()
    expect(
      screen.getByText('1 workflow is delivered under the Environment Global Agent policy.')
    ).toBeTruthy()
    expect(screen.getByText('Agent integrations are current')).toHaveAttribute(
      'data-status',
      'initialized'
    )
  })

  it('preserves the last Agent summary when the shared live projection fails', () => {
    useAgentIntegrationsMock.mockReturnValue({
      data: projection(),
      isLoading: false,
      isRefreshing: false,
      error: new Error('Agent projection disconnected'),
      refresh: vi.fn(),
      accept: vi.fn(),
    })
    renderSections()
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Agent status may be stale/)).toHaveTextContent(
      'Agent projection disconnected'
    )
    expect(screen.getByText('Agent projection failed')).toHaveAttribute('data-status', 'failed')
    expect(screen.getByText('Failed').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('core profile · both')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Manage' })).toBeTruthy()
  })

  it('shows a terminal unavailable state when the shared projection has no data', () => {
    useAgentIntegrationsMock.mockReturnValue({
      data: null,
      isLoading: false,
      isRefreshing: false,
      error: new Error('Agent policy unavailable'),
      refresh: vi.fn(),
      accept: vi.fn(),
    })
    renderSections()

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByText(/Agent status is unavailable/)).toHaveTextContent(
      'Agent policy unavailable'
    )
    expect(screen.getByText('Failed').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Configured').nextElementSibling).toHaveTextContent('—')
    expect(screen.queryByLabelText('Loading Agent Integrations')).toBeNull()
  })
})
