/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Verify Project Binding presents launch/root ownership without registry inference.
 * 2. Verify Store/Reference edits submit one structured, loading-locked mutation.
 * 3. Verify only an active write locks controls while stale/error evidence retains a repair path.
 * 4. Verify mutation preview evidence does not replace the subscribed current Root Context.
 * 5. Verify convergence requires the matching ready Root Context identity and releases on current root error.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-17): "Lock every mutation control while save is pending; preserve dirty input on failure."
 * Original request (2026-07-18): "Project Binding must show direct Reference Store, root, and Doctor diagnostics."
 * Derived requirement (2026-07-19): "A converging binding write must retain the submitted draft until subscription convergence."
 * Original request (2026-07-27): "普通 pending 不应改变命令标签。"
 * Original request (2026-07-28): successful preview, Reference, and settlement evidence should be collapsed by default.
 * Owner correction (2026-07-29): Store uses a registry-backed freeform Combobox; registry failure never blocks explicit repair.
 */
import type { ProjectBindingConfig, ProjectBindingUpdateResult } from '@openspecui/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectBindingSection } from './project-binding-section'
import { useProjectBindingSettlement } from './use-project-binding-settlement'

const { bindingSubscriptionMock, storeProjectionMock, updateProjectBindingMock } = vi.hoisted(
  () => ({
    bindingSubscriptionMock: vi.fn(),
    storeProjectionMock: vi.fn(),
    updateProjectBindingMock: vi.fn(),
  })
)

vi.mock('@/lib/use-planning-config', () => ({
  useProjectBindingSubscription: bindingSubscriptionMock,
}))

vi.mock('@/lib/use-store-list-projection', () => ({
  useStoreListProjection: storeProjectionMock,
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
  } satisfies ProjectBindingConfig
}

function updatedBindingConfig() {
  const current = bindingConfig()
  return {
    ...current,
    file: {
      ...current.file,
      content: 'store: design-system\nreferences: [platform-next]\n',
    },
    binding: {
      store: { state: 'declared' as const, id: 'design-system' },
      references: {
        state: 'declared' as const,
        entries: [{ id: 'platform-next' }],
      },
      diagnostics: [],
    },
    rootPreview: {
      ...current.rootPreview,
      data: {
        ...current.rootPreview.data,
        planningRoot: {
          ...current.rootPreview.data.planningRoot,
          path: '/stores/design-system',
          store_id: 'design-system',
        },
        storeId: 'design-system',
        references: [],
        observedAt: 2,
      },
      observedAt: 2,
    },
  } satisfies ProjectBindingConfig
}

function bindingUpdateResult(
  config = bindingConfig(),
  state: 'converging' | 'preview-error' = 'converging'
): ProjectBindingUpdateResult {
  const error = { code: 'root-unresolved', message: 'Declared Store did not resolve.' } as const
  const launchWrite = {
    state: 'write-complete' as const,
    owner: config.owner,
    file: config.file,
    binding: config.binding,
    completedAt: 1,
  }
  if (state === 'converging') {
    return {
      kind: 'project-binding-update',
      launchWrite,
      rootPreview: config.rootPreview,
      transition: { id: 'binding-transition-1', state: 'converging', observedAt: 1 },
    }
  }
  return {
    kind: 'project-binding-update',
    launchWrite,
    rootPreview: {
      state: 'error',
      data: null,
      attempt: config.rootPreview.data,
      error,
      observedAt: 2,
    },
    transition: { id: 'binding-transition-1', state: 'preview-error', observedAt: 2, error },
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
  const rendered = render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>)
  return {
    ...rendered,
    rerender(nextNode: ReactNode) {
      rendered.rerender(<QueryClientProvider client={queryClient}>{nextNode}</QueryClientProvider>)
    },
  }
}

describe('ProjectBindingSection', () => {
  beforeEach(() => {
    bindingSubscriptionMock.mockReset().mockReturnValue({
      data: bindingConfig(),
      isLoading: false,
      error: null,
    })
    updateProjectBindingMock.mockReset().mockResolvedValue(bindingUpdateResult())
    storeProjectionMock.mockReset().mockReturnValue({
      data: {
        available: true,
        stores: [
          { id: 'shared', root: '/stores/shared' },
          { id: 'registered-design', root: '/stores/registered-design' },
        ],
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      authority: { state: 'current' },
    })
  })

  afterEach(() => cleanup())

  it('shows launch declarations and keeps the resolved preview accessible on demand', () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByText(/Launch project: \/workspace\/launch-app/)).toBeTruthy()
    expect(screen.getByLabelText('Store')).toHaveValue('shared')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform')
    expect(screen.getByRole('note', { name: 'Root preview source declared' })).toBeTruthy()

    const evidenceTrigger = screen.getByRole('button', {
      name: /Root preview and binding evidence/,
    })
    const resolvedRoot = screen.getByText('/stores/shared')
    expect(evidenceTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(resolvedRoot).not.toBeVisible()
    fireEvent.click(evidenceTrigger)
    expect(resolvedRoot).toBeVisible()
  })

  it('makes declaration help available from keyboard-focusable Tooltip buttons', async () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    const storeHelp = screen.getByRole('button', { name: 'About Planning Store' })
    storeHelp.focus()
    expect(storeHelp).toHaveFocus()
    expect(
      await screen.findByText(
        "Select a registered Store suggestion or enter an exact Store id. An empty value keeps the launch project's nearest OpenSpec root."
      )
    ).toBeVisible()
  })

  it('discloses observed Reference warning evidence without claiming a direct failure', () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(
      screen.getByRole('note', {
        name: '1 observed References, 0 errors, 1 diagnostics',
      })
    ).toBeTruthy()
    const warning = screen.getByText(
      'warning · reference_unresolved · Reference is not registered.'
    )
    expect(warning).not.toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Root preview and binding evidence/ }))
    expect(screen.getByText('Store: platform')).toBeVisible()
    expect(screen.getByText('Root: /stores/platform')).toBeVisible()
    expect(warning).toBeVisible()
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

  it('selects a registered Store suggestion while preserving freeform input authority', async () => {
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Show registered Store suggestions' }))
    fireEvent.click(await screen.findByText('registered-design'))
    expect(screen.getByLabelText('Store')).toHaveValue('registered-design')

    fireEvent.change(screen.getByLabelText('Store'), {
      target: { value: 'exact-unregistered-id' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => {
      expect(updateProjectBindingMock).toHaveBeenCalledWith({
        store: 'exact-unregistered-id',
        references: [{ id: 'platform' }],
      })
    })
  })

  it('keeps Store repair editable when registry suggestions are unavailable', () => {
    storeProjectionMock.mockReturnValue({
      data: {
        available: false,
        stores: [],
        error: { kind: 'command-unavailable', message: 'Store list unavailable.' },
      },
      isLoading: false,
      isUpdating: false,
      error: null,
      authority: { state: 'current' },
    })

    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Suggestions unavailable; exact ids remain editable.'
    )
    expect(screen.getByLabelText('Store')).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'repair-store' } })
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
  })

  it('locks every declaration control while one structured save is pending', async () => {
    const pending = createDeferred<ReturnType<typeof bindingUpdateResult>>()
    updateProjectBindingMock.mockReturnValueOnce(pending.promise)
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Save binding' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
    expect(screen.getByLabelText('Store')).toBeDisabled()
    expect(screen.getByLabelText('Reference Store id')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove Reference platform' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    expect(updateProjectBindingMock).toHaveBeenCalledTimes(1)

    pending.resolve(bindingUpdateResult())
    await waitFor(() => expect(screen.getByLabelText('Store')).toHaveValue('design-system'))
  })

  it('keeps the written draft while stale subscription A remains current during convergence', async () => {
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updatedBindingConfig()))
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => {
      expect(
        screen.getByText('Root preview from this mutation: /stores/design-system')
      ).toBeTruthy()
    })
    expect(screen.getByText('/stores/shared')).toBeTruthy()
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform-next')
    expect(screen.getByLabelText('Store')).toBeEnabled()
    expect(screen.getByLabelText('Reference Store id')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()
    expect(
      screen.getByText('Transition: converging · waiting for Root Context subscription')
    ).toBeTruthy()
  })

  it('does not settle when subscription B still carries the stale Root A identity', async () => {
    const rendered = renderSection(<ProjectBindingSection isStatic={false} />)
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updatedBindingConfig()))

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())

    bindingSubscriptionMock.mockReturnValue({
      data: {
        ...updatedBindingConfig(),
        rootPreview: bindingConfig().rootPreview,
      },
      isLoading: false,
      error: null,
    })
    rendered.rerender(<ProjectBindingSection isStatic={false} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform-next')
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()
  })

  it('does not settle when Root B identity matches but data scope provenance is stale', async () => {
    const rendered = renderSection(<ProjectBindingSection isStatic={false} />)
    const updated = updatedBindingConfig()
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updated))

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())

    if (updated.rootPreview.state !== 'ready') throw new Error('Expected a ready test preview.')
    bindingSubscriptionMock.mockReturnValue({
      data: {
        ...updated,
        rootPreview: {
          ...updated.rootPreview,
          data: {
            ...updated.rootPreview.data,
            dataScope: {
              path: '/runtime/other-openspec',
              source: 'user-home-default' as const,
              environmentVariable: null,
            },
          },
        },
      },
      isLoading: false,
      error: null,
    })
    rendered.rerender(<ProjectBindingSection isStatic={false} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()
  })

  it('does not settle retained B data while the Project Binding subscription reports an error', async () => {
    const rendered = renderSection(<ProjectBindingSection isStatic={false} />)
    const updated = updatedBindingConfig()
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updated))

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())

    bindingSubscriptionMock.mockReturnValue({
      data: updated,
      isLoading: false,
      error: new Error('Project Binding subscription disconnected.'),
    })
    rendered.rerender(<ProjectBindingSection isStatic={false} />)

    await waitFor(() => expect(screen.getByLabelText('Store')).toBeEnabled())
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform-next')
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()
    expect(screen.getByText('Project Binding subscription disconnected.')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'repair-after-error' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => {
      expect(updateProjectBindingMock).toHaveBeenLastCalledWith({
        store: 'repair-after-error',
        references: [{ id: 'platform-next' }],
      })
    })
  })

  it('retires pending B before a late B emission can clear a newer C draft', async () => {
    const rendered = renderSection(<ProjectBindingSection isStatic={false} />)
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updatedBindingConfig()))

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => expect(screen.getByLabelText('Store')).toBeEnabled())

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'repair-store-c' } })
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()

    bindingSubscriptionMock.mockReturnValue({
      data: updatedBindingConfig(),
      isLoading: false,
      error: null,
    })
    rendered.rerender(<ProjectBindingSection isStatic={false} />)

    await waitFor(() => expect(screen.getByLabelText('Store')).toHaveValue('repair-store-c'))
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Saved' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => {
      expect(updateProjectBindingMock).toHaveBeenLastCalledWith({
        store: 'repair-store-c',
        references: [{ id: 'platform-next' }],
      })
    })
  })

  it('retires pending convergence exactly when the saved draft generation is edited', () => {
    const config = bindingConfig()
    const { result } = renderHook(() =>
      useProjectBindingSettlement({ config, subscriptionError: null })
    )

    act(() => result.current.mutationSucceeded(bindingUpdateResult(updatedBindingConfig())))
    expect(result.current.pendingConvergence).not.toBeNull()

    act(() => result.current.editStore('repair-store-c'))
    expect(result.current.pendingConvergence).toBeNull()
    expect(result.current.storeId).toBe('repair-store-c')
    expect(result.current.dirty).toBe(true)
  })

  it('retains the draft and releases repair when subscription convergence reports a Root error', async () => {
    const rendered = renderSection(<ProjectBindingSection isStatic={false} />)
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updatedBindingConfig()))

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())

    const updated = updatedBindingConfig()
    if (updated.rootPreview.state !== 'ready') throw new Error('Expected a ready test preview.')
    bindingSubscriptionMock.mockReturnValue({
      data: {
        ...updated,
        rootPreview: {
          state: 'error' as const,
          data: null,
          attempt: updated.rootPreview.data,
          error: {
            code: 'root-unresolved' as const,
            message: 'Subscription Root Context failed.',
          },
          observedAt: 3,
        },
      },
      isLoading: false,
      error: null,
    })
    rendered.rerender(<ProjectBindingSection isStatic={false} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled())
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform-next')
    expect(screen.getAllByText('Subscription Root Context failed.').length).toBeGreaterThan(0)
    expect(
      screen.queryByText(
        'Transition: converging · Root Context subscription matched the launch write'
      )
    ).toBeNull()
    expect(
      screen.getByText(
        'Transition: converging · Root Context subscription error: Subscription Root Context failed.'
      )
    ).toBeTruthy()
  })

  it('retains Store and Reference drafts when fulfilled mutation reports preview error', async () => {
    updateProjectBindingMock.mockResolvedValueOnce(
      bindingUpdateResult(updatedBindingConfig(), 'preview-error')
    )
    renderSection(<ProjectBindingSection isStatic={false} />)

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Declared Store did not resolve.')
    })
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform-next')
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
    expect(screen.getByText('Root preview from this mutation: /stores/design-system')).toBeTruthy()
    expect(
      screen.getByText('Transition: preview-error · Declared Store did not resolve.')
    ).toBeTruthy()
  })

  it('clears dirty state only after subscription B matches the completed launch write', async () => {
    const rendered = renderSection(<ProjectBindingSection isStatic={false} />)
    updateProjectBindingMock.mockResolvedValueOnce(bindingUpdateResult(updatedBindingConfig()))

    fireEvent.change(screen.getByLabelText('Store'), { target: { value: 'design-system' } })
    fireEvent.change(screen.getByLabelText('Reference Store id'), {
      target: { value: 'platform-next' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save binding' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save binding' })).toBeEnabled()
    })

    bindingSubscriptionMock.mockReturnValue({
      data: updatedBindingConfig(),
      isLoading: false,
      error: null,
    })
    rendered.rerender(<ProjectBindingSection isStatic={false} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Save binding' })).toBeDisabled())
    expect(screen.getByLabelText('Store')).toHaveValue('design-system')
    expect(screen.getByText('/stores/design-system')).toBeTruthy()
    expect(
      screen.getByText(
        'Transition: converging · Root Context subscription matched the launch write'
      )
    ).toBeTruthy()
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

  it('keeps stale binding evidence visible while retaining declaration repair controls', () => {
    bindingSubscriptionMock.mockReturnValue({
      data: bindingConfig(),
      isLoading: false,
      error: new Error('binding transport failed'),
    })
    renderSection(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByRole('alert')).toHaveTextContent('binding transport failed')
    expect(screen.getByLabelText('Store')).toBeEnabled()
    expect(screen.getByLabelText('Reference Store id')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Remove Reference platform' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Save binding' })).toBeDisabled()
    expect(updateProjectBindingMock).not.toHaveBeenCalled()
  })

  it('states that static exports do not contain Project Binding', () => {
    renderSection(<ProjectBindingSection isStatic />)

    expect(screen.getByText('Project Binding is not included in this static export.')).toBeTruthy()
    expect(updateProjectBindingMock).not.toHaveBeenCalled()
  })
})
