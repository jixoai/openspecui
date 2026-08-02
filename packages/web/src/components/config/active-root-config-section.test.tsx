/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove Structured and Raw editors retain independent drafts and exact revision locators.
 * 2. Prove loading, replacement, transport, Root, and pending states retain display while locking mutation.
 * 3. Prove conflict, invalid-result, and transport recovery preserve user-authored drafts.
 * 4. Prove shared-Store impact and official diagnostics remain directly visible.
 * 5. Prove static Active Root projection remains source-distinct and read-only.
 *
 * Original request (2026-07-18): "Stale or transport-error Active Root data must remain read-only."
 * Original request (2026-08-01): preserve mode-local Structured and Raw YAML editing with explicit conflict recovery.
 */
import type { ActiveRootConfigView } from '@/lib/use-planning-config'
import type {
  ActiveRootConfig,
  ActiveRootMutationResult,
  ActiveRootRevision,
} from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActiveRootConfigSection } from './active-root-config-section'

const { activeRootSubscriptionMock, rootActionMock, writeActiveRootMock } = vi.hoisted(() => ({
  activeRootSubscriptionMock: vi.fn(),
  rootActionMock: vi.fn(),
  writeActiveRootMock: vi.fn(),
}))

vi.mock('@/lib/use-planning-config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/use-planning-config')>()),
  useActiveRootConfigViewSubscription: activeRootSubscriptionMock,
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    planningConfig: {
      writeActiveRoot: { mutate: writeActiveRootMock },
    },
  },
}))

vi.mock('@/components/scroll-spy', () => ({
  useViewportConstrainedHeight: () => null,
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
    <textarea
      aria-label="Raw YAML editor"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 's') onSaveShortcut?.()
      }}
    />
  ),
}))

const REVISION_A = `sha256:${'a'.repeat(64)}` as ActiveRootRevision
const REVISION_B = `sha256:${'b'.repeat(64)}` as ActiveRootRevision
const REVISION_C = `sha256:${'c'.repeat(64)}` as ActiveRootRevision

function activeRootConfig(
  overrides: Omit<Partial<ActiveRootConfig>, 'file' | 'owner'> & {
    file?: Partial<ActiveRootConfig['file']>
    owner?: Partial<ActiveRootConfig['owner']>
  } = {}
): ActiveRootConfig {
  return {
    kind: 'active-root',
    owner: {
      kind: 'planning-root',
      path: '/stores/shared',
      source: 'store',
      storeId: 'shared',
      externalToLaunchProject: true,
      ...overrides.owner,
    },
    file: {
      path: '/stores/shared/openspec/config.yaml',
      format: 'yaml',
      exists: true,
      content: 'schema: spec-driven\ncontext: original\n',
      ...overrides.file,
    },
    revision: overrides.revision ?? REVISION_A,
    official: overrides.official ?? {
      schema: 'spec-driven',
      context: 'original',
      rules: { proposal: ['Keep intent explicit.'] },
      operations: {
        apply: { guidance: ['Run focused tests.'] },
        archive: { guidance: ['Record evidence.'] },
      },
    },
    diagnostics: overrides.diagnostics ?? [],
  }
}

function configView(config = activeRootConfig()): ActiveRootConfigView {
  return {
    content: config.file.content,
    exists: config.file.exists,
    filePath: config.file.path,
    owner: config.owner,
    revision: config.revision,
    official: config.official,
    diagnostics: config.diagnostics,
  }
}

function subscriptionState(
  data = configView(),
  overrides: { isLoading?: boolean; isUpdating?: boolean; error?: Error | null } = {}
) {
  return {
    data,
    isLoading: overrides.isLoading ?? false,
    isUpdating: overrides.isUpdating ?? false,
    error: overrides.error ?? null,
  }
}

function applied(config = activeRootConfig()): ActiveRootMutationResult {
  return { state: 'applied', config }
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

function renderSection(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
}

function edit() {
  fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
}

function switchMode(name: 'Structured' | 'Raw YAML') {
  fireEvent.click(screen.getByRole('tab', { name }))
}

describe('ActiveRootConfigSection', () => {
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
    activeRootSubscriptionMock.mockReset().mockReturnValue(subscriptionState())
    writeActiveRootMock.mockReset().mockResolvedValue(applied())
  })

  afterEach(() => cleanup())

  it('retains independent Structured and Raw drafts while switching modes', () => {
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()

    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'team-schema' } })
    switchMode('Raw YAML')
    fireEvent.change(screen.getByLabelText('Raw YAML editor'), {
      target: { value: 'schema: raw-team\ncustom: retained\n' },
    })
    switchMode('Structured')
    expect(screen.getByLabelText('Schema')).toHaveValue('team-schema')
    switchMode('Raw YAML')
    expect(screen.getByLabelText('Raw YAML editor')).toHaveValue(
      'schema: raw-team\ncustom: retained\n'
    )
  })

  it('submits Structured changes against the exact owner, file, and loaded revision', async () => {
    const next = activeRootConfig({
      revision: REVISION_B,
      file: { content: 'schema: team-schema\ncontext: updated\n' },
      official: {
        schema: 'team-schema',
        context: 'updated',
        rules: { proposal: ['Keep intent explicit.'] },
        operations: {
          apply: { guidance: ['Run focused tests.'] },
          archive: { guidance: ['Record evidence.'] },
        },
      },
    })
    writeActiveRootMock.mockResolvedValueOnce(applied(next))
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'team-schema' } })
    fireEvent.change(screen.getByLabelText('Project context'), { target: { value: 'updated' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Structured' }))

    await waitFor(() => expect(writeActiveRootMock).toHaveBeenCalledOnce())
    expect(writeActiveRootMock).toHaveBeenCalledWith({
      mode: 'structured',
      ownerPath: '/stores/shared',
      filePath: '/stores/shared/openspec/config.yaml',
      revision: REVISION_A,
      update: {
        schema: 'team-schema',
        context: 'updated',
        rules: { proposal: ['Keep intent explicit.'] },
        operations: {
          apply: { guidance: ['Run focused tests.'] },
          archive: { guidance: ['Record evidence.'] },
        },
      },
    })
  })

  it('submits Raw YAML against the same exact loaded locator', async () => {
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    switchMode('Raw YAML')
    fireEvent.change(screen.getByLabelText('Raw YAML editor'), {
      target: { value: 'schema: spec-driven\nteam: custom\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Raw YAML' }))

    await waitFor(() => expect(writeActiveRootMock).toHaveBeenCalledOnce())
    expect(writeActiveRootMock).toHaveBeenCalledWith({
      mode: 'raw',
      ownerPath: '/stores/shared',
      filePath: '/stores/shared/openspec/config.yaml',
      revision: REVISION_A,
      content: 'schema: spec-driven\nteam: custom\n',
    })
  })

  it('retains a dirty draft while replacement refresh locks every mutation control', () => {
    const view = renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'retained-draft' } })
    activeRootSubscriptionMock.mockReturnValue(
      subscriptionState(configView(), { isUpdating: true })
    )
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ActiveRootConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText('Schema')).toHaveValue('retained-draft')
    expect(screen.getByLabelText('Schema')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save Structured' })).toBeDisabled()
    expect(writeActiveRootMock).not.toHaveBeenCalled()
  })

  it('locks a dirty draft after Root replacement and reloads only on explicit recovery', () => {
    const latest = activeRootConfig({
      revision: REVISION_B,
      owner: { path: '/stores/replacement', storeId: 'replacement' },
      file: {
        path: '/stores/replacement/openspec/config.yaml',
        content: 'schema: replacement\n',
      },
      official: { schema: 'replacement', context: null, rules: null, operations: null },
    })
    const view = renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'local-draft' } })
    activeRootSubscriptionMock.mockReturnValue(subscriptionState(configView(latest)))
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ActiveRootConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Active Root changed after this draft was loaded.'
    )
    expect(screen.getByLabelText('Schema')).toHaveValue('local-draft')
    expect(screen.getByLabelText('Schema')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Reload latest' }))
    expect(screen.getByLabelText('Schema')).toHaveValue('replacement')
    expect(screen.getByLabelText('Schema')).not.toHaveAttribute('readonly')
  })

  it('retains Raw draft on conflict, exposes latest YAML, and retries against the latest revision', async () => {
    const latest = activeRootConfig({
      revision: REVISION_B,
      file: { content: 'schema: external\nexternal: true\n' },
      official: { schema: 'external', context: null, rules: null, operations: null },
    })
    const committed = activeRootConfig({
      revision: REVISION_C,
      file: { content: 'schema: local\nteam: retained\n' },
      official: { schema: 'local', context: null, rules: null, operations: null },
    })
    writeActiveRootMock
      .mockResolvedValueOnce({ state: 'conflict', reason: 'revision-changed', latest })
      .mockResolvedValueOnce(applied(committed))
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    switchMode('Raw YAML')
    fireEvent.change(screen.getByLabelText('Raw YAML editor'), {
      target: { value: 'schema: local\nteam: retained\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Raw YAML' }))

    await waitFor(() =>
      expect(
        screen.getByText('The physical Active Root changed before this save could commit.')
      ).toBeTruthy()
    )
    expect(screen.getByLabelText('Raw YAML editor')).toHaveValue('schema: local\nteam: retained\n')
    fireEvent.click(screen.getByText('Review latest physical YAML'))
    expect(screen.getByText(/external: true/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retry against latest' }))

    await waitFor(() => expect(writeActiveRootMock).toHaveBeenCalledTimes(2))
    expect(writeActiveRootMock).toHaveBeenLastCalledWith({
      mode: 'raw',
      ownerPath: '/stores/shared',
      filePath: '/stores/shared/openspec/config.yaml',
      revision: REVISION_B,
      content: 'schema: local\nteam: retained\n',
    })
  })

  it('retains Raw YAML after typed invalid result and permits a corrected retry', async () => {
    const invalidResult: ActiveRootMutationResult = {
      state: 'invalid',
      reason: 'raw-syntax',
      diagnostics: [
        {
          code: 'config-unparseable',
          severity: 'error',
          path: '$',
          message: 'YAML syntax is invalid.',
        },
      ],
      latest: activeRootConfig(),
    }
    writeActiveRootMock.mockResolvedValueOnce(invalidResult).mockResolvedValueOnce(applied())
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    switchMode('Raw YAML')
    fireEvent.change(screen.getByLabelText('Raw YAML editor'), { target: { value: 'schema: [' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Raw YAML' }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('YAML syntax is invalid.')
    )
    expect(screen.getByLabelText('Raw YAML editor')).toHaveValue('schema: [')
    fireEvent.change(screen.getByLabelText('Raw YAML editor'), {
      target: { value: 'schema: spec-driven\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Raw YAML' }))
    await waitFor(() => expect(writeActiveRootMock).toHaveBeenCalledTimes(2))
  })

  it('retains a dirty draft after transport failure and retries without re-entering edit mode', async () => {
    writeActiveRootMock
      .mockRejectedValueOnce(new Error('write denied'))
      .mockResolvedValueOnce(applied())
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'retry-schema' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Structured' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('write denied'))
    expect(screen.getByLabelText('Schema')).toHaveValue('retry-schema')
    fireEvent.click(screen.getByRole('button', { name: 'Save Structured' }))
    await waitFor(() => expect(writeActiveRootMock).toHaveBeenCalledTimes(2))
  })

  it('keeps pending save controls locked and prevents duplicate submission', async () => {
    const pending = createDeferred<ActiveRootMutationResult>()
    writeActiveRootMock.mockReturnValueOnce(pending.promise)
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'pending-schema' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Structured' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Structured' })).toBeDisabled()
    )
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Schema')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Save Structured' }))
    expect(writeActiveRootMock).toHaveBeenCalledOnce()
    pending.resolve(applied())
  })

  it('rejects a queued save at the mutation boundary after Root readiness is lost', async () => {
    const readyState = rootActionMock()
    const view = renderSection(<ActiveRootConfigSection isStatic={false} />)
    edit()
    fireEvent.change(screen.getByLabelText('Schema'), { target: { value: 'queued-schema' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Structured' }))
    rootActionMock.mockReturnValue({
      ...readyState,
      status: 'blocked',
      disabled: true,
      message: 'Planning root became unavailable.',
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ActiveRootConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Planning root became unavailable.')
    )
    expect(writeActiveRootMock).not.toHaveBeenCalled()
  })

  it('keeps shared Store impact and official diagnostics in the direct plane', () => {
    activeRootSubscriptionMock.mockReturnValue(
      subscriptionState(
        configView(
          activeRootConfig({
            diagnostics: [
              {
                code: 'schema-invalid',
                severity: 'warning',
                path: 'schema',
                message: 'Schema is not a string.',
              },
            ],
          })
        )
      )
    )
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.getByRole('note', { name: 'Shared Store write impact' })).toHaveTextContent(
      'Saves affect every project currently resolving this Store.'
    )
    expect(screen.getByText(/Schema is not a string/)).toBeTruthy()
    expect(screen.getByLabelText('Active Root config revision')).toHaveTextContent(
      'Revision aaaaaaaa'
    )
  })

  it('renders a missing config creation draft while preserving exact non-existent revision evidence', () => {
    activeRootSubscriptionMock.mockReturnValue(
      subscriptionState(
        configView(
          activeRootConfig({
            file: { exists: false, content: null },
            official: { schema: null, context: null, rules: null, operations: null },
          })
        )
      )
    )
    renderSection(<ActiveRootConfigSection isStatic={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Active Root config' }))
    expect(screen.getByLabelText('Schema')).toHaveValue('spec-driven')
    expect(screen.getByRole('button', { name: 'Save Structured' })).toBeEnabled()
  })

  it('renders a static snapshot read-only without mutation controls or invented provenance', () => {
    activeRootSubscriptionMock.mockReturnValue(
      subscriptionState({
        ...configView(),
        owner: null,
        filePath: null,
        revision: null,
      })
    )
    renderSection(<ActiveRootConfigSection isStatic />)

    expect(screen.getByText('Static Active Root snapshot')).toBeTruthy()
    expect(screen.getByLabelText('Schema')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByLabelText('Active Root config revision')).toBeNull()
    expect(writeActiveRootMock).not.toHaveBeenCalled()
  })
})
