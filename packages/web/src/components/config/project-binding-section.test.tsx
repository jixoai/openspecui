/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify Project Binding presents launch/root ownership without registry inference.
 * 2. Verify Store/Reference edits submit one structured, loading-locked mutation.
 * 3. Verify pending/failure/transport state locks writes and retains trustworthy declarations.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-17): "Lock every mutation control while save is pending; preserve dirty input on failure."
 * Original request (2026-07-18): "Project Binding must show direct Reference Store, root, and Doctor diagnostics."
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectBindingSection } from './project-binding-section'

const { bindingSubscriptionMock, updateProjectBindingMock } = vi.hoisted(() => ({
  bindingSubscriptionMock: vi.fn(),
  updateProjectBindingMock: vi.fn(),
}))

vi.mock('@/lib/use-planning-config', () => ({
  useProjectBindingSubscription: bindingSubscriptionMock,
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    planningConfig: {
      updateProjectBinding: { mutate: updateProjectBindingMock },
    },
  },
}))

function bindingConfig() {
  return {
    kind: 'project-binding' as const,
    owner: { kind: 'launch-project' as const, path: '/workspace/launch-app' },
    file: {
      path: '/workspace/launch-app/openspec/config.yaml',
      format: 'yaml' as const,
      exists: true,
      content: 'store: shared\nreferences: [platform]\n',
    },
    binding: {
      store: { state: 'declared' as const, id: 'shared' },
      references: {
        state: 'declared' as const,
        entries: [{ id: 'platform' }],
      },
      diagnostics: [],
    },
    rootPreview: {
      state: 'ready' as const,
      data: {
        launchProject: { path: '/workspace/launch-app' },
        planningRoot: {
          path: '/stores/shared',
          source: 'declared' as const,
          store_id: 'shared',
          healthy: true,
          status: [],
        },
        storeId: 'shared',
        cli: { available: true, version: '1.6.0' },
        references: [
          {
            store_id: 'platform',
            root: '/stores/platform',
            status: [
              {
                severity: 'warning',
                code: 'reference_unresolved',
                message: 'Reference is not registered.',
              },
            ],
          },
        ],
        contextMembers: [],
        dataScope: {
          path: '/runtime/openspec',
          source: 'xdg-data-home' as const,
          environmentVariable: 'XDG_DATA_HOME',
        },
        diagnostics: { root: [], doctor: [], context: [] },
        evidence: { doctor: null, context: null },
        observedAt: 1,
      },
      attempt: null,
      error: null,
      observedAt: 1,
    },
  }
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

describe('ProjectBindingSection', () => {
  beforeEach(() => {
    bindingSubscriptionMock.mockReset().mockReturnValue({
      data: bindingConfig(),
      isLoading: false,
      error: null,
    })
    updateProjectBindingMock.mockReset().mockResolvedValue(bindingConfig())
  })

  afterEach(() => cleanup())

  it('shows launch owner, declared Store/Reference, and resolved root preview', () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByText(/Launch project: \/workspace\/launch-app/)).toBeTruthy()
    expect(screen.getByLabelText('Store')).toHaveValue('shared')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform')
    expect(screen.getByText('/stores/shared')).toBeTruthy()
    expect(screen.getByText('declared')).toBeTruthy()
  })

  it('shows direct Reference Store, root, and Doctor diagnostics as observed evidence', () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByText('Observed References')).toBeTruthy()
    expect(screen.getByText('Store: platform')).toBeTruthy()
    expect(screen.getByText('Root: /stores/platform')).toBeTruthy()
    expect(
      screen.getByText('warning · reference_unresolved · Reference is not registered.')
    ).toBeTruthy()
  })

  it('submits structured Store and Reference declarations', async () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.change(screen.getByLabelText('Remote for platform-next'), {
      target: { value: 'https://example.test/platform.git' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => {
      expect(updateProjectBindingMock).toHaveBeenCalledWith({
        store: 'design-system',
        references: [{ id: 'platform-next', remote: 'https://example.test/platform.git' }],
      })
    })
  })

  it('locks every declaration control while one structured save is pending', async () => {
    const pending = createDeferred<ReturnType<typeof bindingConfig>>()
    updateProjectBindingMock.mockReturnValueOnce(pending.promise)
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled())
    expect(screen.getByLabelText('Store')).toBeDisabled()
    expect(screen.getByLabelText('Reference Store id')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Reference platform' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }))
    expect(updateProjectBindingMock).toHaveBeenCalledTimes(1)

    pending.resolve(bindingConfig())
    await waitFor(() => expect(screen.getByLabelText('Store')).toHaveValue('shared'))
  })

  it('retains dirty declarations and the mutation error after failure', async () => {
    updateProjectBindingMock.mockRejectedValueOnce(new Error('binding write denied'))
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'retained-store' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('binding write denied'))
    expect(screen.getByLabelText('Store')).toHaveValue('retained-store')
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
  })

  it('keeps the launch-owned repair path available when Root Context preview fails', () => {
    const current = bindingConfig()
    bindingSubscriptionMock.mockReturnValue({
      data: {
        ...current,
        rootPreview: {
          state: 'error',
          data: null,
          attempt: current.rootPreview.data,
          error: { code: 'root-unresolved', message: 'Declared Store did not resolve.' },
          observedAt: 2,
        },
      },
      isLoading: false,
      error: null,
    })
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent('Declared Store did not resolve.')
    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'repair-store' } })
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
  })

  it('does not invent an empty writable binding after subscription transport failure', () => {
    bindingSubscriptionMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('binding transport failed'),
    })
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent('binding transport failed')
    expect(screen.queryByLabelText('Store')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save binding' })).toBeNull()
    expect(updateProjectBindingMock).not.toHaveBeenCalled()
  })

  it('keeps stale binding evidence visible but locks every declaration control', () => {
    bindingSubscriptionMock.mockReturnValue({
      data: bindingConfig(),
      isLoading: false,
      error: new Error('binding transport failed'),
    })
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent('binding transport failed')
    expect(screen.getByLabelText('Store')).toBeDisabled()
    expect(screen.getByLabelText('Reference Store id')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Reference platform' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled()
    expect(updateProjectBindingMock).not.toHaveBeenCalled()
  })

  it('states that static exports do not contain Project Binding', () => {
    renderSection(<ProjectBindingSection isStatic />)

    expect(screen.getByText('Project Binding is not included in this static export.')).toBeTruthy()
    expect(updateProjectBindingMock).not.toHaveBeenCalled()
  })
})
