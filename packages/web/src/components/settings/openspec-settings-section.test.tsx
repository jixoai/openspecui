/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Verify Settings projects shared CLI, Root, Environment, and launch-tool lifecycle truth.
 * 2. Verify Init mode, repair, pending, cancellation, terminal, and convergence behavior.
 *
 * Original request (2026-07-20): "Settings exposes 1.6 compatibility, workflow/tool delivery, root selection, environment, and data-scope diagnostics."
 * Owner acceptance boundary (2026-07-20): final end-to-end browser walkthroughs remain owner-owned.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Original request (2026-07-28): Settings should summarize OpenSpec facts and defer evidence to Context and Config.
 */
import type { CliRunnerLine, CliStreamTransport, OverallStatus } from '@/lib/use-cli-runner'
import type { SubscriptionState } from '@/lib/use-subscription'
import type {
  AIToolOption,
  EnvironmentGlobalConfig,
  RootContext,
  RootContextState,
  ToolInitState,
} from '@openspecui/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpenSpecSettingsSections } from './openspec-settings-section'

interface EnvironmentSubscriptionState extends SubscriptionState<EnvironmentGlobalConfig | null> {
  refresh: () => Promise<void>
  refreshPending: boolean
}

interface TestCliRunner {
  lines: CliRunnerLine[]
  status: OverallStatus
  commands: {
    replaceAll: (commands: CliStreamTransport[]) => void
    runAll: () => Promise<void>
  }
  cancel: () => void
  reset: () => void
}

const {
  cancelMock,
  contextSubscriptionMock,
  detectedToolsSubscriptionMock,
  environmentSubscriptionMock,
  replaceAllMock,
  resetMock,
  runAllMock,
  toolInitStatesSubscriptionMock,
  useCliRunnerMock,
  useQueryMock,
} = vi.hoisted(() => ({
  cancelMock: vi.fn<() => void>(),
  contextSubscriptionMock: vi.fn<() => SubscriptionState<RootContextState>>(),
  detectedToolsSubscriptionMock: vi.fn<() => SubscriptionState<AIToolOption[]>>(),
  environmentSubscriptionMock: vi.fn<() => EnvironmentSubscriptionState>(),
  replaceAllMock: vi.fn<(commands: CliStreamTransport[]) => void>(),
  resetMock: vi.fn<() => void>(),
  runAllMock: vi.fn<() => Promise<void>>(),
  toolInitStatesSubscriptionMock:
    vi.fn<
      (input: {
        delivery: 'both' | 'skills' | 'commands'
        workflows: string[]
      }) => SubscriptionState<ToolInitState[]>
    >(),
  useCliRunnerMock: vi.fn<() => TestCliRunner>(),
  useQueryMock: vi.fn(),
}))

vi.mock('@/lib/use-context-subscription', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/use-context-subscription')>()
  return { ...actual, useContextSubscription: contextSubscriptionMock }
})

vi.mock('@/lib/use-planning-config', () => ({
  useEnvironmentGlobalConfigSubscription: environmentSubscriptionMock,
}))

vi.mock('./use-settings-tool-subscriptions', () => ({
  useDetectedProjectToolsSubscription: detectedToolsSubscriptionMock,
  useToolInitStatesSubscription: toolInitStatesSubscriptionMock,
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: useCliRunnerMock,
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: useQueryMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpc: {
    cli: {
      getAllTools: {
        queryOptions: () => ({ queryKey: ['cli.getAllTools'] }),
      },
    },
  },
}))

vi.mock('@/components/copyable-path', () => ({
  CopyablePath: ({ path }: { path: string }) => <code>{path}</code>,
}))

vi.mock('@/components/toc', () => ({
  TocSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    to,
    search,
    children,
  }: {
    to: string
    search?: Record<string, string>
    children: ReactNode
  }) => {
    const query = search ? new URLSearchParams(search).toString() : ''
    return <a href={query ? `${to}?${query}` : to}>{children}</a>
  },
}))

vi.mock('@/components/select', () => ({
  Select: ({
    value,
    options,
    onValueChange,
    ariaLabel,
    disabled,
  }: {
    value: string
    options: Array<{ value: string; label: string }>
    onValueChange: (value: string) => void
    ariaLabel: string
    disabled?: boolean
  }) => (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

vi.mock('@/components/switch', () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ariaLabel,
    disabled,
  }: {
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    ariaLabel: string
    disabled?: boolean
  }) => (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      checked={checked}
      disabled={disabled}
      onChange={(event) => onCheckedChange(event.target.checked)}
    />
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
    footer: ReactNode
  }) =>
    open ? (
      <div role="dialog">
        <div>{title}</div>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}))

vi.mock('@/components/cli-terminal', () => ({
  CliTerminal: ({ lines }: { lines: CliRunnerLine[] }) => (
    <div data-testid="cli-terminal">
      {lines.map((line) => (
        <div key={line.id}>{line.kind === 'ascii' ? line.text : 'rich terminal output'}</div>
      ))}
    </div>
  ),
}))

const ALL_TOOLS: AIToolOption[] = [
  { name: 'Claude', value: 'claude', available: true, successLabel: 'Claude ready' },
  { name: 'Cursor', value: 'cursor', available: true, successLabel: 'Cursor ready' },
]

function rootContext(overrides: Partial<RootContext> = {}): RootContext {
  return {
    launchProject: { path: '/workspace/launch' },
    planningRoot: {
      path: '/workspace/planning',
      source: 'store',
      store_id: 'planning-store',
      healthy: true,
      status: [],
    },
    storeId: 'planning-store',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/runtime/data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 10,
    ...overrides,
  }
}

function readyRoot(context = rootContext()): RootContextState {
  return {
    state: 'ready',
    data: context,
    attempt: null,
    error: null,
    observedAt: context.observedAt,
  }
}

function environmentConfig(): EnvironmentGlobalConfig {
  const config = {
    profile: 'core',
    delivery: 'both',
    workflows: ['propose', 'explore', 'apply', 'update', 'sync', 'archive'],
  }
  return {
    kind: 'environment-global',
    owner: {
      kind: 'runtime-environment',
      dataScope: {
        path: '/runtime/data/openspec',
        source: 'xdg-data-home',
        environmentVariable: 'XDG_DATA_HOME',
      },
    },
    configPath: '/runtime/data/openspec/config.json',
    file: {
      path: '/runtime/data/openspec/config.json',
      format: 'json',
      exists: true,
      content: JSON.stringify(config),
    },
    config,
    profileState: {
      available: true,
      profile: 'core',
      delivery: 'both',
      workflows: [...config.workflows],
      driftStatus: 'in-sync',
      warningText: null,
    },
    evidence: {
      path: {
        success: true,
        stdout: '/runtime/data/openspec/config.json\n',
        stderr: '',
        exitCode: 0,
      },
      config: {
        success: true,
        stdout: JSON.stringify(config),
        stderr: '',
        exitCode: 0,
        data: config,
        payload: config,
        diagnostics: [],
      },
      drift: { success: true, stdout: '', stderr: '', exitCode: 0 },
    },
  }
}

function toolState(toolId: 'claude' | 'cursor', status: ToolInitState['status']): ToolInitState {
  const initialized = status === 'initialized'
  const partial = status === 'partial'
  return {
    toolId,
    toolName: toolId === 'claude' ? 'Claude' : 'Cursor',
    status,
    hasAnyArtifacts: initialized || partial,
    expectedSkillCount: 0,
    presentExpectedSkillCount: 0,
    detectedSkillCount: 0,
    expectedCommandCount: 2,
    presentExpectedCommandCount: initialized ? 2 : partial ? 1 : 0,
    detectedCommandCount: initialized ? 2 : partial ? 2 : 0,
    missingSkillWorkflows: [],
    missingCommandWorkflows: initialized ? [] : partial ? ['update'] : ['apply', 'update'],
    unexpectedSkillWorkflows: [],
    unexpectedCommandWorkflows: partial ? ['explore'] : [],
    legacyCommandWorkflows: partial ? ['apply'] : [],
  }
}

function rootSubscription(
  data: RootContextState | undefined,
  options: { isLoading?: boolean; error?: Error | null } = {}
): SubscriptionState<RootContextState> {
  return {
    data,
    isLoading: options.isLoading ?? false,
    error: options.error ?? null,
  }
}

function environmentSubscription(
  data: EnvironmentGlobalConfig | null | undefined,
  options: {
    isLoading?: boolean
    error?: Error | null
    refreshPending?: boolean
  } = {}
): EnvironmentSubscriptionState {
  return {
    data,
    isLoading: options.isLoading ?? false,
    error: options.error ?? null,
    refresh: vi.fn(async () => {}),
    refreshPending: options.refreshPending ?? false,
  }
}

function runner(status: OverallStatus = 'idle', lines: CliRunnerLine[] = []): TestCliRunner {
  return {
    lines,
    status,
    commands: { replaceAll: replaceAllMock, runAll: runAllMock },
    cancel: cancelMock,
    reset: resetMock,
  }
}

function renderSection() {
  return render(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)
}

describe('OpenSpecSettingsSections', () => {
  beforeEach(() => {
    cancelMock.mockReset()
    replaceAllMock.mockReset()
    resetMock.mockReset()
    runAllMock.mockReset().mockResolvedValue(undefined)
    contextSubscriptionMock.mockReset().mockReturnValue(rootSubscription(readyRoot()))
    environmentSubscriptionMock
      .mockReset()
      .mockReturnValue(environmentSubscription(environmentConfig()))
    detectedToolsSubscriptionMock.mockReset().mockReturnValue({
      data: [ALL_TOOLS[0]],
      isLoading: false,
      error: null,
    })
    toolInitStatesSubscriptionMock.mockReset().mockReturnValue({
      data: [toolState('claude', 'partial'), toolState('cursor', 'uninitialized')],
      isLoading: false,
      error: null,
    })
    useCliRunnerMock.mockReset().mockReturnValue(runner())
    useQueryMock.mockReset().mockReturnValue({ data: ALL_TOOLS, isLoading: false })
  })

  afterEach(() => cleanup())

  it.each([
    {
      name: 'current 1.6',
      cli: { available: true, version: '1.6.4' },
      label: 'Current 1.6 line',
      message: 'matches the OpenSpecUI 6.x target line',
    },
    {
      name: 'legacy 1.5',
      cli: { available: true, version: '1.5.9' },
      label: 'Legacy-compatible 1.5 line',
      message: 'legacy-compatible with OpenSpecUI 6.x',
    },
    {
      name: 'unavailable',
      cli: { available: false, error: 'openspec executable missing' },
      label: 'CLI unavailable',
      message: 'openspec executable missing',
    },
    {
      name: 'unparseable',
      cli: { available: true, version: 'dev-snapshot' },
      label: 'Version unparseable',
      message: 'Unable to parse OpenSpec CLI version',
    },
  ])('uses the shared compatibility classifier for $name', async ({ cli, label, message }) => {
    contextSubscriptionMock.mockReturnValue(rootSubscription(readyRoot(rootContext({ cli }))))

    renderSection()

    const compatibility = screen.getByRole('note', {
      name: `OpenSpec CLI compatibility ${label}`,
    })
    fireEvent.focus(compatibility)
    expect(await screen.findByText(new RegExp(message))).toBeVisible()
  })

  it('renders Root loading as pending without claiming the CLI is unavailable', () => {
    contextSubscriptionMock.mockReturnValue(
      rootSubscription(
        {
          state: 'loading',
          data: null,
          attempt: null,
          error: null,
          observedAt: 0,
        },
        { isLoading: true }
      )
    )

    const { container } = renderSection()

    expect(screen.getByText('Root loading')).toBeTruthy()
    expect(screen.getByText('CLI evidence pending')).toBeTruthy()
    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('Resolving launch and planning roots...')).toBeNull()
    expect(screen.queryByText('CLI unavailable')).toBeNull()
  })

  it('keeps ready, refreshing, stale failed-attempt, and transport-error Root states distinct', async () => {
    const view = renderSection()
    expect(screen.getByText('Root current')).toBeTruthy()
    const launch = screen.getByRole('note', { name: 'Launch project path' })
    fireEvent.focus(launch)
    expect(await screen.findByText('/workspace/launch')).toBeVisible()
    const planning = screen.getByRole('note', { name: 'Planning root selected' })
    fireEvent.focus(planning)
    await waitFor(() => expect(screen.getByText(/\/workspace\/planning/)).toBeVisible())

    const current = rootContext()
    contextSubscriptionMock.mockReturnValue(
      rootSubscription({
        state: 'refreshing',
        data: current,
        attempt: null,
        error: null,
        observedAt: 11,
      })
    )
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)
    expect(screen.getByText('Root refreshing')).toBeTruthy()

    const failedAttempt = rootContext({
      planningRoot: null,
      storeId: 'missing-store',
      observedAt: 12,
      diagnostics: {
        root: [{ severity: 'error', code: 'root-missing', message: 'Store root missing' }],
        doctor: [],
        context: [],
      },
    })
    contextSubscriptionMock.mockReturnValue(
      rootSubscription({
        state: 'error',
        data: current,
        attempt: failedAttempt,
        error: { code: 'resolver-failed', message: 'Root refresh failed' },
        observedAt: 12,
      })
    )
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)
    expect(screen.getByText('Stale Root snapshot')).toBeTruthy()
    expect(screen.getByText('Failed attempt: resolver-failed')).toBeTruthy()
    expect(screen.getByText('Root refresh failed')).toBeTruthy()
    expect(screen.getByText(/Attempted root: unresolved \| Store missing-store/)).toBeTruthy()

    contextSubscriptionMock.mockReturnValue(
      rootSubscription(readyRoot(current), { error: new Error('WebSocket disconnected') })
    )
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)
    expect(screen.getByText('Root transport error')).toBeTruthy()
    expect(screen.getByText('WebSocket disconnected')).toBeTruthy()
  })

  it('projects current Environment truth and exact Context and Config destinations', () => {
    renderSection()

    expect(screen.getByText('Environment current')).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Environment profile core' })).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Environment delivery both' })).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Environment drift in-sync' })).toBeTruthy()
    expect(screen.getByRole('note', { name: '6 effective workflows' })).toBeTruthy()
    expect(
      screen.getByRole('note', { name: 'Environment data scope source xdg-data-home' })
    ).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Root / Doctor / Context details' })).toHaveAttribute(
      'href',
      '/context'
    )
    expect(screen.getByRole('link', { name: /Environment Global config/ })).toHaveAttribute(
      'href',
      '/config?configTab=environment-global'
    )
    expect(screen.queryByRole('button', { name: /Run openspec update/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Set profile/i })).toBeNull()
    expect(toolInitStatesSubscriptionMock).toHaveBeenCalledWith({
      delivery: 'both',
      workflows: ['propose', 'explore', 'apply', 'update', 'sync', 'archive'],
    })
  })

  it('locks Init while Environment Global is loading or refreshing', () => {
    environmentSubscriptionMock.mockReturnValue(
      environmentSubscription(undefined, { isLoading: true })
    )
    const view = renderSection()

    expect(screen.getByText('Environment loading')).toBeTruthy()
    expect(screen.getByText('Waiting for current Environment Global delivery')).toBeTruthy()
    expect(screen.queryByLabelText('Init Mode')).toBeNull()
    expect(toolInitStatesSubscriptionMock).not.toHaveBeenCalled()

    environmentSubscriptionMock.mockReturnValue(
      environmentSubscription(environmentConfig(), { refreshPending: true })
    )
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)
    expect(screen.getByText('Environment refreshing')).toBeTruthy()
    expect(screen.getByText('Waiting for current Environment Global delivery')).toBeTruthy()
    expect(screen.queryByLabelText('Init Mode')).toBeNull()
  })

  it('preserves stale Environment evidence while locking Init on subscription error', () => {
    environmentSubscriptionMock.mockReturnValue(
      environmentSubscription(environmentConfig(), {
        error: new Error('Environment subscription disconnected'),
      })
    )

    renderSection()

    expect(screen.getByText('Stale environment projection')).toBeTruthy()
    expect(screen.getByText('Environment subscription disconnected')).toBeTruthy()
    expect(screen.getByText('Initialization locked by stale Environment Global state')).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Environment profile core' })).toBeTruthy()
    expect(screen.queryByLabelText('Init Mode')).toBeNull()
    expect(toolInitStatesSubscriptionMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      mode: 'auto',
      action: 'Initialize (auto-detect)',
      expected: { type: 'init', input: { force: true } },
    },
    {
      mode: 'all',
      action: 'Initialize with all tools',
      expected: { type: 'init', input: { tools: 'all', force: true } },
    },
  ])(
    'builds the $mode Init command through the typed runner',
    async ({ mode, action, expected }) => {
      renderSection()
      if (mode === 'all') {
        fireEvent.change(screen.getByLabelText('Init Mode'), { target: { value: 'all' } })
      }

      fireEvent.click(screen.getByRole('button', { name: action }))

      await waitFor(() => expect(replaceAllMock).toHaveBeenLastCalledWith([expected]))
      expect(screen.getByRole('dialog')).toBeTruthy()
    }
  )

  it('builds selected Init from repairable tools and preserves partial and legacy evidence', async () => {
    renderSection()
    fireEvent.change(screen.getByLabelText('Init Mode'), { target: { value: 'selected' } })

    expect(screen.getByText('missing commands: update')).toBeTruthy()
    expect(screen.getByText('unexpected commands: explore')).toBeTruthy()
    expect(screen.getByText('legacy commands: apply')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /^Claude/ }))
    const action = screen.getByRole('button', { name: 'Initialize selected (1 repair)' })
    expect(action).toBeEnabled()
    fireEvent.click(action)

    await waitFor(() =>
      expect(replaceAllMock).toHaveBeenLastCalledWith([
        { type: 'init', input: { tools: ['claude'], force: true } },
      ])
    )
  })

  it('locks pending controls while preserving terminal output and cancellation', async () => {
    const view = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Initialize (auto-detect)' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())

    useCliRunnerMock.mockReturnValue(
      runner('running', [{ id: 'line-1', kind: 'ascii', text: 'initializing claude' }])
    )
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)

    expect(screen.getByText('initializing claude')).toBeTruthy()
    expect(screen.getByLabelText('Init Mode')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Initializing' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(cancelMock).toHaveBeenCalled()
  })

  it('converges partial tool evidence after a successful Init subscription update', async () => {
    const view = renderSection()
    fireEvent.click(screen.getByRole('button', { name: 'Initialize (auto-detect)' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy())

    useCliRunnerMock.mockReturnValue(
      runner('success', [{ id: 'line-1', kind: 'ascii', text: 'OpenSpec initialized' }])
    )
    toolInitStatesSubscriptionMock.mockReturnValue({
      data: [toolState('claude', 'initialized'), toolState('cursor', 'uninitialized')],
      isLoading: false,
      error: null,
    })
    view.rerender(<OpenSpecSettingsSections diagnosticsIndex={0} initializationIndex={1} />)

    expect(screen.getByText('OpenSpec initialized')).toBeTruthy()
    expect(screen.getByText('1 initialized')).toBeTruthy()
    expect(screen.getByText('0 repair needed')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Run init' })).toBeNull()
  })
})
