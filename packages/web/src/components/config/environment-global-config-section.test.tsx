/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify environment-global path, data-scope, CLI evidence, and static absence.
 * 2. Verify JSON writes preserve unknown fields and reject invalid/non-object drafts.
 * 3. Verify mutation pending/failure state and gated typed Planning-root Update dispatch.
 * 4. Verify Profile/Drift refresh with the environment-global subscription.
 *
 * Original request (2026-07-15): "Environment Global Config projects openspec config path plus config list --json."
 * Original request (2026-07-17): "CliStreamTransport is the single execution and display truth."
 * Original request (2026-07-18): "Update and auto-Update must use useRootActionState."
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
  }: {
    value: string
    onChange?: (value: string) => void
    readOnly?: boolean
  }) => (
    <textarea
      aria-label="Environment Global config editor"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

vi.mock('@/components/cli-terminal', () => ({
  CliTerminal: ({ lines }: { lines: unknown[] }) => (
    <div data-testid="cli-terminal">{lines.length}</div>
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
      refresh: vi.fn(),
    })
    replaceAllMock.mockReset()
    runAllMock.mockReset().mockResolvedValue(undefined)
    writeEnvironmentGlobalMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('shows CLI path, inherited data scope, raw evidence, and unknown fields', () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    expect(screen.getByText('/runtime/openspec/config.json', { selector: 'code' })).toBeTruthy()
    expect(screen.getByText('/runtime/openspec')).toBeTruthy()
    expect(screen.getByText(/xdg-data-home/)).toBeTruthy()
    expect(screen.getByText('CLI evidence')).toBeTruthy()
    expect(screen.getByText('futureField')).toBeTruthy()
    expect(screen.getByText('/runtime/openspec/config.json', { selector: 'dd' })).toBeTruthy()
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
      refresh: vi.fn(),
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
      refresh: vi.fn(),
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

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Revert' })).toBeDisabled()
    expect(screen.getByLabelText('Environment Global config editor')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Saving...' }))
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

  it('shows loading and no-data errors without inventing an empty config', () => {
    environmentGlobalSubscriptionMock.mockReturnValueOnce({
      data: undefined,
      isLoading: true,
      error: null,
      refresh: vi.fn(),
    })
    const { unmount } = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)
    expect(screen.getByText('Loading Environment Global config...')).toBeTruthy()
    unmount()

    environmentGlobalSubscriptionMock.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      error: new Error('config list failed'),
      refresh: vi.fn(),
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

  it('blocks Apply auto-Update when Root Context is unavailable', async () => {
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
      refresh: vi.fn(),
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Profile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Propose change' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }))
    fireEvent.click(screen.getByRole('button', { name: 'Apply profile' }))

    await waitFor(() => expect(writeEnvironmentGlobalMock).toHaveBeenCalledTimes(1))
    expect(replaceAllMock).not.toHaveBeenCalled()
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
