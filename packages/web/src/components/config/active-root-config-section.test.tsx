/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Verify Active Root presence, empty content, owner provenance, and static projection states.
 * 2. Verify loading/error topology without conflating transport failure and file absence.
 * 3. Verify save pending/failure locks, dirty-draft retention, and the real mutation boundary.
 *
 * Original request (2026-07-17): "An existing empty Active Root file remains editable."
 * Original request (2026-07-18): "Stale or transport-error Active Root data must remain read-only."
 * Original request (2026-07-27): "普通 pending 不应改变命令标签。"
 * Original request (2026-07-28): successful Config provenance should remain accessible through compact badges.
 */
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

vi.mock('@/lib/use-planning-config', () => ({
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
  }: {
    value: string
    onChange?: (value: string) => void
    readOnly?: boolean
  }) => (
    <textarea
      aria-label="Active Root config editor"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
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

function configView(overrides: { content?: string | null; exists?: boolean } = {}) {
  return {
    content: 'content' in overrides ? (overrides.content ?? null) : 'schema: spec-driven\n',
    exists: overrides.exists ?? true,
    filePath: '/stores/shared/openspec/config.yaml',
    owner: {
      kind: 'planning-root' as const,
      path: '/stores/shared',
      source: 'declared' as const,
      storeId: 'shared',
      externalToLaunchProject: true,
    },
  }
}

function renderSection(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
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
    activeRootSubscriptionMock.mockReset().mockReturnValue({
      data: configView(),
      isLoading: false,
      error: null,
    })
    writeActiveRootMock.mockReset().mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('renders absence only when exists is false and opens a creation draft', () => {
    activeRootSubscriptionMock.mockReturnValue({
      data: configView({ content: null, exists: false }),
      isLoading: false,
      error: null,
    })
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.getByText('No config file exists in the active Planning root.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Create Active Root config' }))
    expect(
      (screen.getByLabelText('Active Root config editor') as HTMLTextAreaElement).value
    ).toContain('schema: spec-driven')
  })

  it.each([
    { label: 'empty', content: '' },
    { label: 'non-empty', content: 'schema: custom\n' },
  ])('keeps an existing $label file editable', ({ content }) => {
    activeRootSubscriptionMock.mockReturnValue({
      data: configView({ content, exists: true }),
      isLoading: false,
      error: null,
    })
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.queryByText('No config file exists in the active Planning root.')).toBeNull()
    expect(screen.getByLabelText('Active Root config editor')).toHaveValue(content)
  })

  it('shows external Store owner and file provenance through accessible badges', async () => {
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.getByText('Planning root: /stores/shared')).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Active Root source declared' })).toBeTruthy()
    expect(screen.getByRole('note', { name: 'Active Root Store shared' })).toBeTruthy()
    expect(
      screen.getByRole('note', { name: 'Active Root is external to the launch project' })
    ).toBeTruthy()
    const fileBadge = screen.getByRole('note', { name: 'Active Root config file path' })
    fireEvent.focus(fileBadge)
    expect(await screen.findByText('/stores/shared/openspec/config.yaml')).toBeVisible()
    expect(
      screen.getByText(
        'Edits write the Store-backed planning root and are observed by other projects resolving Store shared.'
      )
    ).toBeTruthy()
  })

  it('distinguishes initial loading from absence', () => {
    activeRootSubscriptionMock.mockReturnValue({ data: undefined, isLoading: true, error: null })
    const { container } = renderSection(<ActiveRootConfigSection isStatic={false} />)

    // Initial-loading is now a visual skeleton rather than routine loading copy.
    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('No config file exists in the active Planning root.')).toBeNull()
  })

  it('renders a no-data subscription error instead of absence', () => {
    activeRootSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('doctor failed'),
    })
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent('doctor failed')
    expect(screen.queryByText('No config file exists in the active Planning root.')).toBeNull()
  })

  it('keeps stale data visible but locks the editor beside a refresh error', () => {
    rootActionMock.mockReturnValue({
      status: 'checking',
      disabled: true,
      context: null,
      observedAt: 1,
      title: 'Refreshing planning root',
      message: 'Root-dependent actions remain locked while OpenSpec refreshes root selection.',
      evidence: [],
    })
    activeRootSubscriptionMock.mockReturnValue({
      data: configView({ content: '', exists: true }),
      isLoading: false,
      error: new Error('refresh failed'),
    })
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.getByLabelText('Active Root config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('alert')).toHaveTextContent('refresh failed')
  })

  it('locks stale Active Root data when its own transport fails', () => {
    activeRootSubscriptionMock.mockReturnValue({
      data: configView({ content: 'schema: stale\n', exists: true }),
      isLoading: false,
      error: new Error('active config transport failed'),
    })
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.getByLabelText('Active Root config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('alert')).toHaveTextContent('active config transport failed')
  })

  it('keeps Cancel available when readiness is lost after editing starts', () => {
    const view = renderSection(<ActiveRootConfigSection isStatic={false} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Active Root config editor'), {
      target: { value: 'schema: local draft\n' },
    })

    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'planning root failed',
      evidence: [],
    })
    activeRootSubscriptionMock.mockReturnValue({
      data: configView(),
      isLoading: false,
      error: new Error('root refresh failed'),
    })
    view.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ActiveRootConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    expect(screen.getByLabelText('Active Root config editor')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(writeActiveRootMock).not.toHaveBeenCalled()
  })

  it('rejects a queued Save at the real mutation boundary after readiness is lost', async () => {
    const readyRootAction = {
      status: 'ready' as const,
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null as string | null,
      evidence: [],
    }
    rootActionMock.mockReturnValue(readyRootAction)
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={queryClient}>
        <ActiveRootConfigSection isStatic={false} />
      </QueryClientProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Active Root config editor'), {
      target: { value: 'schema: queued draft\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Replace the hook result before TanStack runs mutationFn. This is a real
    // component mutation boundary, not a direct invocation of the handler.
    rootActionMock.mockReturnValue({
      ...readyRootAction,
      status: 'blocked',
      disabled: true,
      message: 'Planning root became unavailable.',
    })
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <ActiveRootConfigSection isStatic={false} />
      </QueryClientProvider>
    )

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Planning root became unavailable.')
    )
    expect(writeActiveRootMock).not.toHaveBeenCalled()
  })

  it('locks the editor, save, and cancel controls while one save is pending', async () => {
    const pending = createDeferred<void>()
    writeActiveRootMock.mockReturnValueOnce(pending.promise)
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Active Root config editor'), {
      target: { value: 'schema: changed\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    })
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByLabelText('Active Root config editor')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(writeActiveRootMock).toHaveBeenCalledTimes(1)

    pending.resolve()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy())
  })

  it('retains the dirty draft and error after save failure', async () => {
    writeActiveRootMock.mockRejectedValueOnce(new Error('write denied'))
    renderSection(<ActiveRootConfigSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Active Root config editor'), {
      target: { value: 'schema: retained\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('write denied'))
    expect(screen.getByLabelText('Active Root config editor')).toHaveValue('schema: retained\n')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('renders the static Active Root snapshot read-only without mutation controls', () => {
    activeRootSubscriptionMock.mockReturnValue({
      data: { ...configView({ content: '', exists: true }), filePath: null, owner: null },
      isLoading: false,
      error: null,
    })
    renderSection(<ActiveRootConfigSection isStatic />)

    expect(screen.getByText('Static Active Root snapshot')).toBeTruthy()
    expect(screen.getByLabelText('Active Root config editor')).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(writeActiveRootMock).not.toHaveBeenCalled()
  })
})
