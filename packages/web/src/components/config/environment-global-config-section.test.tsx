/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Verify environment-global path, data-scope, CLI evidence, and static absence.
 * 2. Verify JSON writes preserve unknown fields and reject invalid/non-object drafts.
 * 3. Verify mutation pending/failure state and gated typed Planning-root Update dispatch.
 * 4. Verify Profile/Drift refresh with the environment-global subscription.
 *
 * Original request (2026-07-15): "Environment Global Config projects openspec config path plus config list --json."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 * Original request (2026-07-18): "Update and auto-Update must use useRootActionState."
 * Original request (2026-07-18): "Environment Global Profile Apply remains valid when Root Context is blocked; only Update is root-owned."
 * Original request (2026-07-26): "缓存更新期间仍可读，但不能授权写入。"
 * Original request (2026-07-27): "普通 pending 不应改变命令标签。"
 * Original request (2026-07-28): successful Environment provenance and raw CLI evidence should use indirect space.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvironmentGlobalConfigSection } from './environment-global-config-section'

const {
  environmentGlobalSubscriptionMock,
  rootActionMock,
  replaceAllMock,
  runAllMock,
  writeEnvironmentGlobalMock,
} = vi.hoisted(() => ({
  environmentGlobalSubscriptionMock: vi.fn(),
  rootActionMock: vi.fn(),
  replaceAllMock: vi.fn(),
  runAllMock: vi.fn(),
  writeEnvironmentGlobalMock: vi.fn(),
}))

vi.mock('@/lib/use-planning-config', () => ({
  useEnvironmentGlobalConfigSubscription: environmentGlobalSubscriptionMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    planningConfig: {
      writeEnvironmentGlobal: { mutate: writeEnvironmentGlobalMock },
    },
  },
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    commands: { replaceAll: replaceAllMock, runAll: runAllMock },
    reset: vi.fn(),
  }),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({ createDedicatedSession: vi.fn() }),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: { getAreaForPath: () => 'main' },
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: { push: vi.fn() },
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: ({
    value,
    onChange,
    readOnly,
    onSaveShortcut,
  }: {
    value: string
    onChange?: (value: string) => void
    readOnly?: boolean
    onSaveShortcut?: () => void
  }) => (
    <>
      <textarea
        aria-label="Environment Global config editor"
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <button type="button" data-testid="environment-save-shortcut" onClick={onSaveShortcut}>
        Trigger save shortcut
      </button>
    </>
  ),
}))

vi.mock('@/components/cli-terminal', () => ({
  CliTerminal: ({ lines }: { lines: Array<{ text?: string }> }) => (
    <div data-testid="cli-terminal">
      {lines.map((line, index) => (
        <div key={index}>{line.text ?? ''}</div>
      ))}
    </div>
  ),
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

function environmentGlobalConfig() {
  const config = {
    profile: 'core',
    delivery: 'both',
    workflows: ['propose', 'apply'],
    futureField: { nested: true },
  }
  return {
    kind: 'environment-global' as const,
    owner: {
      kind: 'runtime-environment' as const,
      dataScope: {
        path: '/runtime/openspec',
        source: 'xdg-data-home' as const,
        environmentVariable: 'XDG_DATA_HOME',
      },
    },
    configPath: '/runtime/openspec/config.json',
    file: {
      path: '/runtime/openspec/config.json',
      format: 'json' as const,
      exists: true,
      content: JSON.stringify(config),
    },
    config,
    profileState: {
      available: true,
      profile: 'core' as const,
      delivery: 'both' as const,
      workflows: ['propose', 'apply'],
      driftStatus: 'in-sync' as const,
      warningText: null,
    },
    evidence: {
      path: {
        success: true,
        stdout: '/runtime/openspec/config.json\n',
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
      drift: {
        success: true,
        stdout: '',
        stderr: '',
        exitCode: 0,
      },
    },
  }
}

function renderSection(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
}

describe('EnvironmentGlobalConfigSection', () => {
  beforeEach(() => {
    rootActionMock.mockReset().mockReturnValue({
      status: 'ready',
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null,
      evidence: [],
    })
    environmentGlobalSubscriptionMock.mockReset().mockReturnValue({
      data: environmentGlobalConfig(),
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    replaceAllMock.mockReset()
    runAllMock.mockReset().mockResolvedValue(undefined)
    writeEnvironmentGlobalMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('shows compact paths and preserves collapsed raw CLI evidence and unknown fields', async () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    const configPath = screen.getByRole('note', { name: 'Environment Global config file path' })
    fireEvent.focus(configPath)
    await waitFor(() => {
      expect(
        [...document.querySelectorAll('[data-base-ui-portal]')].some((portal) =>
          portal.textContent?.includes('/runtime/openspec/config.json')
        )
      ).toBe(true)
    })

    const dataScope = screen.getByRole('note', {
      name: 'OpenSpec data scope source xdg-data-home',
    })
    fireEvent.focus(dataScope)
    await waitFor(() => {
      expect(
        [...document.querySelectorAll('[data-base-ui-portal]')].some((portal) =>
          portal.textContent?.includes('/runtime/openspec')
        )
      ).toBe(true)
    })

    const evidenceTrigger = screen.getByRole('button', { name: /CLI evidence/ })
    const rawPath = screen.getByText('/runtime/openspec/config.json', { selector: 'dd' })
    expect(evidenceTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(rawPath).not.toBeVisible()
    expect(screen.getByText('futureField')).toBeTruthy()
    fireEvent.click(evidenceTrigger)
    expect(rawPath).toBeVisible()
  })

  it('refreshes profile and drift from the reactive environment projection', async () => {
    const current = environmentGlobalConfig()
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={queryClient}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    await waitFor(() => expect(screen.getByText('core')).toBeTruthy())

    environmentGlobalSubscriptionMock.mockReturnValue({
      data: {
        ...current,
        config: { ...current.config, profile: 'custom', delivery: 'skills' },
        profileState: {
          ...current.profileState,
          profile: 'custom',
          delivery: 'skills',
          driftStatus: 'drift',
          warningText: 'Global config is not applied to this project.',
        },
      },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByText('custom')).toBeTruthy()
    expect(screen.getAllByText('skills').length).toBeGreaterThan(0)
    expect(screen.getByText('drift')).toBeTruthy()
    expect(screen.getByText('Global config is not applied to this project.')).toBeTruthy()
  })

  it('uses effective Core workflows when the raw config omits workflows', async () => {
    const current = environmentGlobalConfig()
    const coreWorkflows = ['propose', 'explore', 'apply', 'update', 'sync', 'archive']
    environmentGlobalSubscriptionMock.mockReturnValue({
      data: {
        ...current,
        config: { profile: 'core', delivery: 'both' },
        profileState: {
          ...current.profileState,
          workflows: coreWorkflows,
        },
      },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    await waitFor(() =>
      expect(screen.getByText(`selected: [${coreWorkflows.join(', ')}]`)).toBeTruthy()
    )
    expect(screen.getByRole('button', { name: 'Apply' })).toHaveAttribute('data-activity', 'true')
  })

  it('dispatches auto-Update exactly once after a successful profile refresh', async () => {
    const refreshMock = vi.fn().mockResolvedValue(undefined)
    const current = environmentGlobalConfig()
    environmentGlobalSubscriptionMock.mockReturnValue({
      data: current,
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: refreshMock,
      refreshPending: false,
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Explore ideas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply profile' }))

    await waitFor(() => expect(writeEnvironmentGlobalMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(replaceAllMock).toHaveBeenCalledTimes(1))
    expect(replaceAllMock).toHaveBeenCalledWith([{ type: 'planning-root-update' }])
    expect(runAllMock).toHaveBeenCalledTimes(1)
  })

  it('keeps raw contract drift evidence visible beside the last projection', () => {
    const current = environmentGlobalConfig()
    environmentGlobalSubscriptionMock.mockReturnValue({
      data: {
        ...current,
        evidence: {
          ...current.evidence,
          config: { ...current.evidence.config, contractError: 'futureField: invalid shape' },
        },
      },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'OpenSpec global config contract drift: futureField: invalid shape'
    )
    expect(screen.getByText('futureField')).toBeTruthy()
    expect(screen.getByText('futureField: invalid shape')).toBeTruthy()
  })

  it('preserves unknown fields when saving a complete JSON draft', async () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: {
        value: JSON.stringify({
          profile: 'core',
          delivery: 'commands',
          workflows: ['update'],
          futureField: { nested: true },
        }),
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(writeEnvironmentGlobalMock).toHaveBeenCalledWith({
        config: {
          profile: 'core',
          delivery: 'commands',
          workflows: ['update'],
          futureField: { nested: true },
        },
      })
    })
  })

  it.each([
    { draft: '{broken', error: /Unexpected|JSON/ },
    { draft: '[]', error: /must be a JSON object/ },
  ])('rejects invalid or non-object JSON before mutation', async ({ draft, error }) => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: draft },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(error))
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
  })

  it('locks editor controls and prevents a duplicate write while save is pending', async () => {
    const pending = createDeferred<void>()
    writeEnvironmentGlobalMock.mockReturnValueOnce(pending.promise)
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: '{"profile":"custom","futureField":true}' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Revert' })).toBeDisabled()
    expect(screen.getByLabelText('Environment Global config editor')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(writeEnvironmentGlobalMock).toHaveBeenCalledTimes(1)

    pending.resolve()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Preview' })).toBeTruthy())
  })

  it('retains the dirty JSON draft and mutation error after failure', async () => {
    writeEnvironmentGlobalMock.mockRejectedValueOnce(new Error('global write denied'))
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: '{"profile":"custom","futureField":"retained"}' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('global write denied'))
    expect(screen.getByLabelText('Environment Global config editor')).toHaveValue(
      '{"profile":"custom","futureField":"retained"}'
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('rejects stale JSON Save and keyboard shortcut at the mutation boundary', async () => {
    const current = environmentGlobalConfig()
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: '{"profile":"custom"}' },
    })

    environmentGlobalSubscriptionMock.mockReturnValue({
      data: current,
      isLoading: false,
      error: new Error('global refresh failed'),
      authority: { state: 'failed', error: new Error('global refresh failed') },
      refresh: vi.fn(),
      refreshPending: false,
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText('Environment Global config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByTestId('environment-save-shortcut'))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('global refresh failed')
    )
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
  })

  it('locks a retained config snapshot when the replacement CLI evidence fails', () => {
    const current = environmentGlobalConfig()
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: '{"profile":"custom"}' },
    })

    environmentGlobalSubscriptionMock.mockReturnValue({
      data: {
        ...current,
        evidence: {
          ...current.evidence,
          config: {
            ...current.evidence.config,
            success: false,
            stderr: 'config list failed',
            exitCode: 1,
          },
        },
      },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByRole('alert')).toHaveTextContent('config list failed')
    expect(screen.getByLabelText('Environment Global config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByTestId('environment-save-shortcut'))
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
  })

  it('keeps every write locked across the asynchronous refresh pending window', async () => {
    const current = environmentGlobalConfig()
    const refreshMock = vi.fn()
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: '{"profile":"custom"}' },
    })

    environmentGlobalSubscriptionMock.mockReturnValue({
      data: current,
      isLoading: false,
      error: null,
      authority: { state: 'waiting', reason: 'rebind' },
      refresh: refreshMock,
      refreshPending: true,
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    const refreshButton = screen.getByRole('button', { name: 'Refresh' })
    expect(refreshButton).toBeDisabled()
    fireEvent.click(refreshButton)
    expect(refreshMock).not.toHaveBeenCalled()

    expect(screen.getByLabelText('Environment Global config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByTestId('environment-save-shortcut'))
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
  })

  it('keeps a cached config display-only while the subscription rebinds', () => {
    const current = environmentGlobalConfig()
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Editor' }))
    fireEvent.change(screen.getByLabelText('Environment Global config editor'), {
      target: { value: '{"profile":"custom"}' },
    })

    environmentGlobalSubscriptionMock.mockReturnValue({
      data: current,
      isLoading: false,
      error: null,
      authority: { state: 'waiting', reason: 'rebind' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText('Environment Global config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getByTestId('environment-save-shortcut'))
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
  })

  it('does not confirm an already-open Apply dialog after the projection becomes stale', () => {
    const current = environmentGlobalConfig()
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Propose change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: 'Apply profile' })).toBeEnabled()

    environmentGlobalSubscriptionMock.mockReturnValue({
      data: current,
      isLoading: false,
      error: new Error('global projection became stale'),
      authority: { state: 'failed', error: new Error('global projection became stale') },
      refresh: vi.fn(),
      refreshPending: false,
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    const confirm = screen.getByRole('button', { name: 'Apply profile' })
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
    expect(runAllMock).not.toHaveBeenCalled()
  })

  it('disables an already-open Update dialog after a new blocked Root Action rerender', () => {
    const readyRootAction = {
      status: 'ready' as const,
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null as string | null,
      evidence: [],
    }
    const blockedRootAction = {
      status: 'blocked' as const,
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'Root Context changed while the dialog was open.',
      evidence: ['Doctor exit: 1'],
    }
    rootActionMock.mockReturnValue(readyRootAction)
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run update' }))
    const confirm = screen.getByRole('button', { name: 'Run command' })
    expect(confirm).toBeEnabled()

    rootActionMock.mockReturnValue(blockedRootAction)
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByRole('button', { name: 'Run command' })).toBeDisabled()
    // Bypass only the DOM disabled attribute so the real confirmation handler
    // re-checks the newly rendered Root Action before reaching the runner.
    confirm.removeAttribute('disabled')
    fireEvent.click(confirm)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Root Context changed while the dialog was open.'
    )
    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(runAllMock).not.toHaveBeenCalled()
  })

  it('keeps an open Apply dialog writable after a new blocked Root Action rerender', async () => {
    const readyRootAction = {
      status: 'ready' as const,
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null as string | null,
      evidence: [],
    }
    const blockedRootAction = {
      status: 'checking' as const,
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Resolving planning root',
      message: 'Root Context is resolving.',
      evidence: [],
    }
    rootActionMock.mockReturnValue(readyRootAction)
    const view = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Propose change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: 'Apply profile' })).toBeEnabled()

    rootActionMock.mockReturnValue(blockedRootAction)
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <EnvironmentGlobalConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    const confirm = screen.getByRole('button', { name: 'Apply profile' })
    expect(confirm).toBeEnabled()
    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toBeEnabled()
    fireEvent.click(confirm)
    await waitFor(() => expect(writeEnvironmentGlobalMock).toHaveBeenCalledTimes(1))
    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(runAllMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('cli-terminal')).toHaveTextContent(
      'Planning-root Update skipped: Root Context is resolving.'
    )
    fireEvent.click(close)
    expect(screen.queryByRole('button', { name: 'Apply profile' })).toBeNull()
  })

  it('shows loading and no-data errors without inventing an empty config', () => {
    environmentGlobalSubscriptionMock.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      error: null,
      authority: { state: 'waiting', reason: 'initial' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    const { unmount, container } = renderSection(
      <EnvironmentGlobalConfigSection isStatic={false} />
    )
    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    unmount()

    environmentGlobalSubscriptionMock.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      error: new Error('config list failed'),
      authority: { state: 'failed', error: new Error('config list failed') },
      refresh: vi.fn(),
      refreshPending: false,
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent('config list failed')
    expect(screen.getByText('Global config unavailable.')).toBeTruthy()
  })

  it('dispatches Run update only through the typed Planning-root transport', async () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run update' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run command' }))

    await waitFor(() => {
      expect(replaceAllMock).toHaveBeenCalledWith([{ type: 'planning-root-update' }])
      expect(runAllMock).toHaveBeenCalledTimes(1)
    })
  })

  it('does not open or dispatch Run update while Root Context is not ready', () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 1,
      title: 'Planning root unavailable',
      message: 'Root Context failed.',
      evidence: ['Doctor exit: 1'],
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    const update = screen.getByRole('button', { name: 'Run update' })
    expect(update).toBeDisabled()
    fireEvent.click(update)
    expect(screen.queryByRole('button', { name: 'Run command' })).toBeNull()
    expect(replaceAllMock).not.toHaveBeenCalled()
  })

  it('allows blocked-root Apply to write global config and skips planning-root Update', async () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 1,
      title: 'Planning root unavailable',
      message: 'Root Context failed.',
      evidence: ['Doctor exit: 1'],
    })
    const current = environmentGlobalConfig()
    environmentGlobalSubscriptionMock.mockReturnValue({
      data: {
        ...current,
        config: { ...current.config, workflows: [] },
        profileState: current.profileState,
      },
      isLoading: false,
      error: null,
      authority: { state: 'current' },
      refresh: vi.fn(),
      refreshPending: false,
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Propose change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('button', { name: 'Apply profile' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Apply profile' }))

    await waitFor(() => expect(writeEnvironmentGlobalMock).toHaveBeenCalledTimes(1))
    expect(replaceAllMock).not.toHaveBeenCalled()
    expect(runAllMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('cli-terminal')).toHaveTextContent(
      'Planning-root Update skipped: Root Context failed.'
    )
  })

  it('states static unavailability without exposing runtime facts or mutations', () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic />)

    expect(
      screen.getByText('Environment Global Config is unavailable in static export mode.')
    ).toBeTruthy()
    expect(screen.queryByText('/runtime/openspec/config.json')).toBeNull()
    expect(writeEnvironmentGlobalMock).not.toHaveBeenCalled()
    expect(replaceAllMock).not.toHaveBeenCalled()
  })
})
