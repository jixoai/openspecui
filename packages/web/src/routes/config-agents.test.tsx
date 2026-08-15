/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove Config Agents renders Environment policy plus complete physical Agent status.
 * 2. Prove structured policy mutation stays inside the Agent Router owner.
 * 3. Prove Agent selection prepares the dedicated Init Terminal transport.
 * 4. Prove exact installed, missing, unexpected, and legacy workflow inventories remain readable.
 * 5. Prove replacement Push preserves dirty policy drafts and reports external policy conflicts.
 *
 * Original request (2026-08-01): `/config/agents` is the only structured Agent mutation surface.
 * Review correction (2026-08-02): replacement projection fixtures must prove their target row exists.

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import type { AgentIntegrationsProjection } from '@/lib/use-agent-integrations'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
  acceptMock,
  refreshMock,
  replaceAllMock,
  resetMock,
  runAllMock,
  updatePolicyMock,
  useAgentIntegrationsMock,
  useCliRunnerMock,
} = vi.hoisted(() => ({
  acceptMock: vi.fn(),
  refreshMock: vi.fn(),
  replaceAllMock: vi.fn(),
  resetMock: vi.fn(),
  runAllMock: vi.fn(),
  updatePolicyMock: vi.fn(),
  useAgentIntegrationsMock: vi.fn(),
  useCliRunnerMock: vi.fn(),
}))

vi.mock('@/lib/use-agent-integrations', () => ({
  useAgentIntegrations: useAgentIntegrationsMock,
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: useCliRunnerMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    agentIntegrations: {
      updatePolicy: { mutate: updatePolicyMock },
    },
  },
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

vi.mock('@/components/dialog', () => ({
  Dialog: ({
    open,
    title,
    children,
    footer,
  }: {
    open: boolean
    title: ReactNode
    children: ReactNode
    footer?: ReactNode
  }) =>
    open ? (
      <div role="dialog">
        <div>{title}</div>
        {children}
        {footer}
      </div>
    ) : null,
}))

vi.mock('@/components/cli-terminal', () => ({
  CliTerminal: () => <div data-testid="agent-terminal" />,
}))

import { ConfigAgents } from './config-agents'

function createProjection(): AgentIntegrationsProjection {
  return {
    registry: [
      {
        name: 'Codex',
        value: 'codex',
        available: true,
        skillsDir: '.agents',
        legacySkillsDirs: ['.codex'],
        detectionPaths: ['.agents/skills', '.codex/skills'],
        capability: 'skills-invocable',
        command: null,
        requiresIdeRestart: true,
      },
      {
        name: 'Shared .agents skills',
        value: 'agents',
        available: true,
        skillsDir: '.agents',
        detectionPaths: ['.agents/skills'],
        capability: 'skills-invocable',
        command: null,
      },
      {
        name: 'MiniMax Code',
        value: 'minimax-code',
        available: true,
        skillsDir: null,
        globalSkillsDir: '.minimax',
        capability: 'skills-invocable',
        command: null,
      },
    ],
    policy: {
      profile: 'core',
      delivery: 'both',
      workflows: ['propose', 'apply', 'archive'],
    },
    states: [
      {
        toolId: 'codex',
        toolName: 'Codex',
        status: 'cleanup-needed',
        readiness: 'partial',
        issues: ['cleanup-needed'],
        hasAnyArtifacts: true,
        skillsScope: { kind: 'project', skillsDir: '.agents' },
        legacySkillRoots: ['.codex'],
        requiresIdeRestart: true,
        commandSurfaceUnavailableReason: null,
        expectedSkillCount: 3,
        presentExpectedSkillCount: 2,
        detectedSkillCount: 2,
        expectedCommandCount: 0,
        presentExpectedCommandCount: 0,
        detectedCommandCount: 0,
        missingSkillWorkflows: ['archive'],
        missingCommandWorkflows: [],
        unexpectedSkillWorkflows: [],
        unexpectedCommandWorkflows: [],
        legacyCommandWorkflows: [],
        installedSkillWorkflows: ['propose', 'apply'],
        installedCommandWorkflows: [],
        generatedByVersion: '1.6.0',
        cleanup: {
          required: true,
          kind: 'managed-global-prompts',
          paths: ['/tmp/.codex/prompts/opsx-apply.md'],
          workflows: ['apply'],
          replacementLabel: 'skills',
        },
      },
      {
        toolId: 'agents',
        toolName: 'Shared .agents skills',
        status: 'uninitialized',
        readiness: 'uninitialized',
        issues: [],
        hasAnyArtifacts: false,
        skillsScope: { kind: 'project', skillsDir: '.agents' },
        legacySkillRoots: [],
        requiresIdeRestart: false,
        commandSurfaceUnavailableReason: null,
        expectedSkillCount: 0,
        presentExpectedSkillCount: 0,
        detectedSkillCount: 0,
        expectedCommandCount: 0,
        presentExpectedCommandCount: 0,
        detectedCommandCount: 0,
        missingSkillWorkflows: [],
        missingCommandWorkflows: [],
        unexpectedSkillWorkflows: [],
        unexpectedCommandWorkflows: [],
        legacyCommandWorkflows: [],
        installedSkillWorkflows: [],
        installedCommandWorkflows: [],
        generatedByVersion: null,
      },
      {
        toolId: 'minimax-code',
        toolName: 'MiniMax Code',
        status: 'uninitialized',
        readiness: 'uninitialized',
        issues: [],
        hasAnyArtifacts: false,
        skillsScope: { kind: 'user-global', globalSkillsDir: '.minimax' },
        legacySkillRoots: [],
        requiresIdeRestart: false,
        commandSurfaceUnavailableReason: null,
        expectedSkillCount: 3,
        presentExpectedSkillCount: 0,
        detectedSkillCount: 0,
        expectedCommandCount: 0,
        presentExpectedCommandCount: 0,
        detectedCommandCount: 0,
        missingSkillWorkflows: ['propose', 'apply', 'archive'],
        missingCommandWorkflows: [],
        unexpectedSkillWorkflows: [],
        unexpectedCommandWorkflows: [],
        legacyCommandWorkflows: [],
        installedSkillWorkflows: [],
        installedCommandWorkflows: [],
        generatedByVersion: null,
      },
    ],
  }
}

describe('ConfigAgents', () => {
  beforeEach(() => {
    const projection = createProjection()
    acceptMock.mockClear()
    refreshMock.mockReset().mockResolvedValue(projection)
    replaceAllMock.mockClear()
    resetMock.mockClear()
    runAllMock.mockClear()
    updatePolicyMock.mockReset().mockResolvedValue(projection)
    useAgentIntegrationsMock.mockReturnValue({
      data: projection,
      error: null,
      isLoading: false,
      isRefreshing: false,
      refresh: refreshMock,
      accept: acceptMock,
    })
    useCliRunnerMock.mockReturnValue({
      lines: [],
      status: 'idle',
      exitCode: null,
      hasStarted: false,
      commands: {
        remove: vi.fn(),
        list: vi.fn(() => []),
        replaceAll: replaceAllMock,
        run: vi.fn(),
        runAll: runAllMock,
      },
      reset: resetMock,
      cancel: vi.fn(),
    })
  })

  afterEach(() => cleanup())

  it('renders complete status and saves policy through the Agent owner', async () => {
    render(<ConfigAgents />)

    expect(screen.getByRole('heading', { name: 'Agent Integrations' })).toBeVisible()
    expect(screen.getByText('Codex')).toBeVisible()
    expect(screen.getByText('Shared .agents skills', { selector: 'p' })).toBeVisible()
    expect(screen.getByText('Cleanup needed')).toBeVisible()
    const codexRow = screen.getByText('Codex').closest('li')
    if (!codexRow) throw new Error('Codex inventory row is unavailable.')
    const codexEvidence = within(codexRow)
    expect(codexEvidence.getByText('Installed skills:').nextElementSibling).toHaveTextContent(
      'propose, apply'
    )
    expect(codexEvidence.getByText('Missing skills:').nextElementSibling).toHaveTextContent(
      'archive'
    )
    expect(codexEvidence.getByText('Unexpected skills:').nextElementSibling).toHaveTextContent(
      'None'
    )
    expect(codexEvidence.getByText('Installed commands:').nextElementSibling).toHaveTextContent(
      'None'
    )
    expect(codexEvidence.getByText('Missing commands:').nextElementSibling).toHaveTextContent(
      'None'
    )
    expect(codexEvidence.getByText('Unexpected commands:').nextElementSibling).toHaveTextContent(
      'None'
    )
    expect(codexEvidence.getByText('Legacy commands:').nextElementSibling).toHaveTextContent('None')

    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }))

    await waitFor(() =>
      expect(updatePolicyMock).toHaveBeenCalledWith({
        profile: 'core',
        delivery: 'both',
        workflows: ['propose', 'apply', 'archive'],
      })
    )
    expect(acceptMock).toHaveBeenCalledTimes(1)
  })

  it('prepares selected Agent Init in the cancellable Terminal dialog', () => {
    render(<ConfigAgents />)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Codex' }))
    fireEvent.click(screen.getByRole('button', { name: 'Init selected' }))

    expect(resetMock).toHaveBeenCalledTimes(1)
    expect(replaceAllMock).toHaveBeenCalledWith([
      { type: 'agent-init', input: { tools: ['codex'] } },
    ])
    expect(screen.getByRole('dialog')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }))
    expect(runAllMock).toHaveBeenCalledTimes(1)
  })

  it('adopts the saved replacement policy as the clean draft baseline', async () => {
    const savedProjection = createProjection()
    savedProjection.policy.delivery = 'skills'
    updatePolicyMock.mockResolvedValueOnce(savedProjection)
    render(<ConfigAgents />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Agent delivery mode' }))
    const skillsOnlyOption = await screen.findByRole('option', { name: 'Skills only' })
    fireEvent.mouseMove(skillsOnlyOption)
    fireEvent.click(skillsOnlyOption)
    await screen.findByText('Unsaved policy changes')
    fireEvent.click(screen.getByRole('button', { name: 'Save policy' }))

    await waitFor(() =>
      expect(updatePolicyMock).toHaveBeenCalledWith({
        profile: 'core',
        delivery: 'skills',
        workflows: ['propose', 'apply', 'archive'],
      })
    )
    await waitFor(() => expect(screen.queryByText('Unsaved policy changes')).toBeNull())
    expect(acceptMock).toHaveBeenCalledWith(savedProjection)
  })

  it('preserves a dirty policy draft across inventory Push and reports external policy changes', async () => {
    const initial = createProjection()
    useAgentIntegrationsMock.mockReturnValue({
      data: initial,
      error: null,
      isLoading: false,
      isRefreshing: false,
      refresh: refreshMock,
      accept: acceptMock,
    })
    const { rerender } = render(<ConfigAgents />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Agent delivery mode' }))
    const skillsOnlyOption = await screen.findByRole('option', { name: 'Skills only' })
    fireEvent.mouseMove(skillsOnlyOption)
    fireEvent.click(skillsOnlyOption)
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Agent delivery mode' })).toHaveTextContent(
        'Skills only'
      )
    )
    expect(screen.getByText('Unsaved policy changes')).toBeVisible()

    const inventoryReplacement = createProjection()
    const codexState = inventoryReplacement.states.find((state) => state.toolId === 'codex')
    if (!codexState) throw new Error('Codex inventory fixture is unavailable.')
    inventoryReplacement.states = inventoryReplacement.states.map((state) =>
      state === codexState ? { ...state, generatedByVersion: '1.7.0' } : state
    )
    useAgentIntegrationsMock.mockReturnValue({
      data: inventoryReplacement,
      error: null,
      isLoading: false,
      isRefreshing: false,
      refresh: refreshMock,
      accept: acceptMock,
    })
    rerender(<ConfigAgents />)

    expect(screen.getByRole('combobox', { name: 'Agent delivery mode' })).toHaveTextContent(
      'Skills only'
    )
    expect(screen.queryByText('Agent delivery policy changed outside this page.')).toBeNull()

    const externalPolicyReplacement = createProjection()
    externalPolicyReplacement.policy = {
      profile: 'custom',
      delivery: 'commands',
      workflows: ['verify'],
    }
    useAgentIntegrationsMock.mockReturnValue({
      data: externalPolicyReplacement,
      error: null,
      isLoading: false,
      isRefreshing: false,
      refresh: refreshMock,
      accept: acceptMock,
    })
    rerender(<ConfigAgents />)

    expect(screen.getByRole('combobox', { name: 'Agent delivery mode' })).toHaveTextContent(
      'Skills only'
    )
    expect(
      screen.getByText(
        'Agent delivery policy changed outside this page. Your unsaved draft is preserved.'
      )
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Use current policy' }))
    await waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Agent delivery mode' })).toHaveTextContent(
        'Commands only'
      )
    )
    expect(screen.queryByRole('button', { name: 'Use current policy' })).toBeNull()
  })
})
