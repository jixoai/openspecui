/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Verify Project Binding presents launch/root ownership without registry inference.
 * 2. Verify Store/Reference edits submit one structured, loading-locked mutation.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: {
    mutationFn: () => Promise<unknown>
    onSuccess?: (data: unknown) => void
    onError?: (error: unknown) => void
  }) => ({
    mutate: () => {
      void options.mutationFn().then(options.onSuccess).catch(options.onError)
    },
    isPending: false,
    isSuccess: false,
    error: null,
  }),
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
        references: [],
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
    render(<ProjectBindingSection isStatic={false} />)

    expect(screen.getByText(/Launch project: \/workspace\/launch-app/)).toBeTruthy()
    expect(screen.getByLabelText('Store')).toHaveValue('shared')
    expect(screen.getByLabelText('Reference Store id')).toHaveValue('platform')
    expect(screen.getByText('/stores/shared')).toBeTruthy()
    expect(screen.getByText('declared')).toBeTruthy()
  })

  it('submits structured Store and Reference declarations', async () => {
    render(<ProjectBindingSection isStatic={false} />)

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

  it('states that static exports do not contain Project Binding', () => {
    render(<ProjectBindingSection isStatic />)

    expect(screen.getByText('Project Binding is not included in this static export.')).toBeTruthy()
    expect(updateProjectBindingMock).not.toHaveBeenCalled()
  })
})
