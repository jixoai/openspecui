/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Verify machine `defaultStore` freeform suggestions, explicit clear, and pending/stale locks.
 * 2. Verify configured Environment settlement never fabricates CLI-effective Root success.
 * 3. Verify Raw JSON writes preserve Agent policy and unknown environment-global fields.
 * 4. Verify loading, error, evidence, and static absence remain explicit.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 machine `defaultStore` while retaining raw JSON authority.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EnvironmentGlobalConfigSection } from './environment-global-config-section'

const {
  environmentGlobalSubscriptionMock,
  rootActionMock,
  storeProjectionMock,
  writeEnvironmentDefaultStoreMock,
  writeEnvironmentGlobalMock,
} = vi.hoisted(() => ({
  environmentGlobalSubscriptionMock: vi.fn(),
  rootActionMock: vi.fn(),
  storeProjectionMock: vi.fn(),
  writeEnvironmentDefaultStoreMock: vi.fn(),
  writeEnvironmentGlobalMock: vi.fn(),
}))

vi.mock('@/lib/use-planning-config', () => ({
  useEnvironmentGlobalConfigSubscription: environmentGlobalSubscriptionMock,
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))

vi.mock('@/lib/use-store-list-projection', () => ({
  useStoreListProjection: storeProjectionMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    planningConfig: {
      writeEnvironmentDefaultStore: { mutate: writeEnvironmentDefaultStoreMock },
      writeEnvironmentGlobal: { mutate: writeEnvironmentGlobalMock },
    },
  },
}))

vi.mock('@/components/config/store-id-combobox', () => ({
  StoreIdCombobox: ({
    ariaLabel,
    value,
    disabled,
    onChange,
  }: {
    ariaLabel: string
    value: string
    disabled?: boolean
    onChange: (value: string) => void
  }) => (
    <input
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
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

function environmentGlobalConfig(
  defaultStore:
    | { state: 'absent'; id: null }
    | { state: 'configured'; id: string }
    | { state: 'invalid'; id: null; value: number | string } = {
    state: 'configured',
    id: 'team-plans',
  }
) {
  const config = {
    profile: 'core',
    delivery: 'both',
    workflows: ['propose', 'apply'],
    defaultStore:
      defaultStore.state === 'configured'
        ? defaultStore.id
        : defaultStore.state === 'invalid'
          ? defaultStore.value
          : undefined,
    featureFlags: { experimental: true },
    futureField: { nested: true },
  }
  const serialized = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== undefined)
  )
  return {
    kind: 'environment-global' as const,
    owner: {
      kind: 'runtime-environment' as const,
      dataScope: {
        path: '/runtime/openspec',
        source: 'xdg-data-home' as const,
        environmentVariable: 'XDG_DATA_HOME' as const,
      },
    },
    configPath: '/runtime/config/openspec/config.json',
    file: {
      path: '/runtime/config/openspec/config.json',
      format: 'json' as const,
      exists: true,
      content: JSON.stringify(serialized),
    },
    config: serialized,
    defaultStore,
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
        stdout: '/runtime/config/openspec/config.json\n',
        stderr: '',
        exitCode: 0,
      },
      config: {
        success: true,
        stdout: JSON.stringify(serialized),
        stderr: '',
        exitCode: 0,
        data: serialized,
        payload: serialized,
        diagnostics: [],
      },
      drift: { success: true, stdout: '', stderr: '', exitCode: 0 },
    },
  }
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    data: environmentGlobalConfig(),
    isLoading: false,
    error: null,
    authority: { state: 'current' as const },
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshPending: false,
    ...overrides,
  }
}

function readyRoot(
  source: 'nearest' | 'global_default' = 'global_default',
  storeId: string | null = 'team-plans'
) {
  return {
    status: 'ready' as const,
    disabled: false as const,
    context: {
      planningRoot: {
        path: source === 'global_default' ? '/stores/team-plans' : '/workspace/project',
        source,
        ...(storeId ? { store_id: storeId } : {}),
        healthy: true,
        status: [],
      },
      storeId,
    },
    observedAt: 1,
    title: null,
    message: null,
    evidence: [],
  }
}

function renderSection(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('EnvironmentGlobalConfigSection', () => {
  beforeEach(() => {
    environmentGlobalSubscriptionMock.mockReturnValue(subscription())
    rootActionMock.mockReturnValue(readyRoot())
    storeProjectionMock.mockReturnValue({
      data: {
        available: true,
        stores: [{ id: 'team-plans', root: '/stores/team-plans' }],
      },
      isLoading: false,
      error: null,
    })
    writeEnvironmentDefaultStoreMock.mockResolvedValue({
      kind: 'environment-default-store-update',
    })
    writeEnvironmentGlobalMock.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows configured and independently effective global fallback evidence', () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    expect(screen.getByLabelText('Default Store')).toHaveValue('team-plans')
    expect(screen.getByText('Effective fallback: team-plans')).toBeTruthy()
    expect(screen.getByText('1 registered suggestions available')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Profile' })).toBeNull()
  })

  it('keeps a freeform write locked until its replacement refresh settles', async () => {
    const pending = createDeferred<{ kind: string }>()
    const refresh = createDeferred<void>()
    environmentGlobalSubscriptionMock.mockReturnValue(
      subscription({ refresh: vi.fn(() => refresh.promise) })
    )
    writeEnvironmentDefaultStoreMock.mockReturnValueOnce(pending.promise)
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Default Store'), {
      target: { value: 'unregistered-exact-id' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set default' }))

    await waitFor(() =>
      expect(writeEnvironmentDefaultStoreMock).toHaveBeenCalledWith({
        value: 'unregistered-exact-id',
      })
    )
    expect(screen.getByLabelText('Default Store')).toBeDisabled()
    pending.resolve({ kind: 'environment-default-store-update' })
    await waitFor(() => expect(screen.getByLabelText('Default Store')).toBeDisabled())
    expect(screen.queryByText('Effective fallback: unregistered-exact-id')).toBeNull()
    refresh.resolve()
  })

  it('unlocks with an explicit mismatch when the current replacement disagrees', async () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Default Store'), {
      target: { value: 'concurrently-replaced' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Set default' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'replacement projection settled with a different value'
      )
    })
    expect(screen.getByLabelText('Default Store')).toBeEnabled()
    expect(screen.getByLabelText('Default Store')).toHaveValue('team-plans')
  })

  it('clears through the explicit null mutation', async () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() =>
      expect(writeEnvironmentDefaultStoreMock).toHaveBeenCalledWith({ value: null })
    )
  })

  it('keeps exact editing available when registry suggestions fail', () => {
    storeProjectionMock.mockReturnValue({
      data: { available: false, stores: [], error: { message: 'registry unavailable' } },
      isLoading: false,
      error: null,
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    expect(screen.getByText('Suggestions unavailable; exact ids remain editable.')).toBeTruthy()
    expect(screen.getByLabelText('Default Store')).toBeEnabled()
  })

  it('shows invalid authored values and locks structured writes while authority is stale', () => {
    environmentGlobalSubscriptionMock.mockReturnValue(
      subscription({
        data: environmentGlobalConfig({ state: 'invalid', id: null, value: 42 }),
        authority: { state: 'waiting' },
      })
    )
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent('authored `defaultStore` value is invalid')
    expect(screen.getByLabelText('Default Store')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled()
  })

  it('surfaces stale fallback diagnostics from Root Context instead of configured-value inference', () => {
    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable (doctor-command-failed)',
      message: "Global defaultStore 'team-plans': Unknown store 'team-plans'.",
      evidence: ['Doctor unknown_store: clear the stale global default'],
    })
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Global defaultStore 'team-plans'")
    expect(screen.queryByText(/^Effective fallback:/)).toBeNull()
  })

  it('preserves Agent policy and unknown fields through Raw JSON whole-document writes', async () => {
    renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Raw JSON' }))
    const editor = screen.getByLabelText('Environment Global config editor')
    fireEvent.change(editor, {
      target: {
        value: JSON.stringify({
          profile: 'custom',
          delivery: 'skills',
          workflows: ['apply'],
          defaultStore: 'team-plans',
          featureFlags: { experimental: false },
          futureField: { nested: 'preserved' },
        }),
      },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(writeEnvironmentGlobalMock).toHaveBeenCalledWith({
        config: {
          profile: 'custom',
          delivery: 'skills',
          workflows: ['apply'],
          defaultStore: 'team-plans',
          featureFlags: { experimental: false },
          futureField: { nested: 'preserved' },
        },
      })
    )
  })

  it('keeps loading, failure, and static authority explicit', () => {
    environmentGlobalSubscriptionMock.mockReturnValue(
      subscription({
        data: null,
        isLoading: true,
        error: new Error('config list failed'),
        authority: { state: 'failed', error: new Error('config list failed') },
      })
    )
    const live = renderSection(<EnvironmentGlobalConfigSection isStatic={false} />)
    expect(screen.getByRole('alert')).toHaveTextContent('config list failed')
    live.unmount()

    renderSection(<EnvironmentGlobalConfigSection isStatic />)
    expect(screen.getByText('Environment Global Config is unavailable in static export mode.'))
    expect(writeEnvironmentDefaultStoreMock).not.toHaveBeenCalled()
  })
})
