/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Verify routed Config schema selection.
 * 2. Verify Project Binding, Active Root, and Environment Global ownership surfaces.
 * 3. Prove Active Root file presence is independent from empty content.
 * 4. Prove Schema and Template mutation controls consume the shared Root gate.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-17): "An existing empty Active Root file remains editable."
 * Original request (2026-07-18): "Schema and Template mutations must use useRootActionState."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from './config'

const {
  activeRootConfigMock,
  configBundleMock,
  environmentGlobalConfigMock,
  idleMutation,
  initSchemaMutateMock,
  isStaticModeMock,
  rootActionMock,
} = vi.hoisted(() => ({
  activeRootConfigMock: vi.fn(),
  configBundleMock: vi.fn(),
  environmentGlobalConfigMock: vi.fn(),
  idleMutation: { mutate: vi.fn(), isPending: false, isSuccess: false },
  initSchemaMutateMock: vi.fn(),
  isStaticModeMock: vi.fn(),
  rootActionMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: {
    mutationFn: (variables: unknown) => unknown
    onSuccess?: (data: unknown, variables: unknown) => void
    onError?: (error: unknown) => void
  }) => ({
    mutate: (variables: unknown, callbacks?: { onSuccess?: (data: unknown) => void }) => {
      idleMutation.mutate(variables)
      try {
        const result = options.mutationFn(variables)
        Promise.resolve(result).then(
          (data) => {
            options.onSuccess?.(data, variables)
            callbacks?.onSuccess?.(data)
          },
          (error: unknown) => options.onError?.(error)
        )
      } catch (error) {
        options.onError?.(error)
      }
    },
    isPending: false,
    isSuccess: false,
  }),
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}))

vi.mock('@/components/file-explorer', () => ({
  FileExplorer: ({ emptyState }: { emptyState?: ReactNode }) => (
    <div data-testid="file-explorer">{emptyState}</div>
  ),
  FileExplorerCodeEditor: () => <div data-testid="file-explorer-code-editor" />,
}))

vi.mock('@/components/markdown-viewer', () => ({
  MarkdownViewer: () => <div data-testid="markdown-viewer" />,
}))

vi.mock('@/components/scroll-spy', () => ({
  useViewportConstrainedHeight: () => null,
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: isStaticModeMock,
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({ createDedicatedSession: vi.fn() }),
}))

vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    planningConfig: {
      writeActiveRoot: { mutate: vi.fn() },
      writeEnvironmentGlobal: { mutate: vi.fn() },
    },
    opsx: {
      createSchemaDirectory: { mutate: vi.fn() },
      createSchemaFile: { mutate: vi.fn() },
      deleteSchema: { mutate: vi.fn() },
      deleteSchemaEntry: { mutate: vi.fn() },
      forkSchema: { mutate: vi.fn() },
      initSchema: { mutate: initSchemaMutateMock },
      writeSchemaFile: { mutate: vi.fn() },
    },
  },
}))

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    commands: {
      replaceAll: vi.fn(),
      runAll: vi.fn(),
    },
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}))

vi.mock('@/lib/use-planning-config', () => ({
  useActiveRootConfigViewSubscription: activeRootConfigMock,
  useEnvironmentGlobalConfigSubscription: environmentGlobalConfigMock,
  useProjectBindingSubscription: () => ({ data: null, isLoading: false, error: null }),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => configBundleMock(),
  useOpsxSchemaFilesSubscription: () => ({ data: [], error: null }),
  useOpsxTemplateContentsSubscription: () => ({ data: {} }),
  useOpsxTemplatesSubscription: () => ({ data: {} }),
}))

describe('Config schema tabs', () => {
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
    isStaticModeMock.mockReturnValue(true)
    activeRootConfigMock.mockReturnValue({
      data: {
        content: 'schema: spec-driven',
        exists: true,
        filePath: null,
        owner: null,
      },
      isLoading: false,
      error: null,
    })
    environmentGlobalConfigMock.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
    window.history.replaceState(null, '', '/config?configTab=schema:opsx-collab-pr-loop')
    configBundleMock.mockReturnValue({
      data: {
        schemas: [
          {
            name: 'opsx-collab-pr-loop',
            description: 'Collaborative PR loop',
            artifacts: [],
            source: 'project',
          },
          {
            name: 'spec-driven',
            description: 'Default OpenSpec workflow',
            artifacts: [],
            source: 'package',
          },
        ],
        schemaDetails: {
          'opsx-collab-pr-loop': { name: 'opsx-collab-pr-loop', artifacts: [] },
          'spec-driven': { name: 'spec-driven', artifacts: [] },
        },
        schemaResolutions: {
          'opsx-collab-pr-loop': {
            name: 'opsx-collab-pr-loop',
            source: 'project',
            path: '/project/openspec/schemas/opsx-collab-pr-loop',
            shadows: [],
          },
          'spec-driven': {
            name: 'spec-driven',
            source: 'package',
            path: '/package/schemas/spec-driven',
            shadows: [],
          },
        },
      },
      isLoading: false,
      error: null,
    })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('keeps schema tab selection controlled by the routed tab state', async () => {
    render(<Config />)

    fireEvent.click(screen.getByRole('button', { name: /Schema\(spec-driven\)/ }))

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('configTab')).toBe(
        'schema:spec-driven'
      )
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Schema\(spec-driven\)/ })).toHaveClass(
        'tab-selected'
      )
    })

    expect(screen.getByRole('button', { name: /Schema\(opsx-collab-pr-loop\)/ })).not.toHaveClass(
      'tab-selected'
    )
  })

  it('exposes the three ownership-specific Config surfaces without legacy tab names', async () => {
    window.history.replaceState(null, '', '/config?configTab=active-root')
    render(<Config />)

    expect(screen.getByRole('button', { name: 'Project Binding' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Active Root' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Environment Global' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Project Config' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Global Config' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Environment Global' }))

    await waitFor(() => {
      expect(new URLSearchParams(window.location.search).get('configTab')).toBe(
        'environment-global'
      )
    })
    expect(
      screen.getByText('Environment Global Config is unavailable in static export mode.')
    ).toBeTruthy()
  })

  it('shows live Active Root and Environment Global ownership evidence', async () => {
    isStaticModeMock.mockReturnValue(false)
    activeRootConfigMock.mockReturnValue({
      data: {
        content: 'schema: spec-driven',
        exists: true,
        filePath: '/stores/shared/openspec/config.yaml',
        owner: {
          kind: 'planning-root',
          path: '/stores/shared',
          source: 'declared',
          storeId: 'shared',
          externalToLaunchProject: true,
        },
      },
      isLoading: false,
      error: null,
    })
    environmentGlobalConfigMock.mockReturnValue({
      data: {
        kind: 'environment-global',
        owner: {
          kind: 'runtime-environment',
          dataScope: {
            path: '/runtime/openspec',
            source: 'xdg-data-home',
            environmentVariable: 'XDG_DATA_HOME',
          },
        },
        file: {
          path: '/runtime/openspec/config.json',
          format: 'json',
          exists: true,
          content: '{"profile":"core"}',
        },
        config: { profile: 'core', delivery: 'both', workflows: ['propose'] },
        evidence: {
          path: {
            success: true,
            stdout: '/runtime/openspec/config.json\n',
            stderr: '',
            exitCode: 0,
          },
          config: {
            success: true,
            stdout: '{"profile":"core","delivery":"both","workflows":["propose"]}',
            stderr: '',
            exitCode: 0,
            data: { profile: 'core', delivery: 'both', workflows: ['propose'] },
            payload: { profile: 'core', delivery: 'both', workflows: ['propose'] },
            diagnostics: [],
          },
          drift: {
            success: true,
            stdout: '',
            stderr: '',
            exitCode: 0,
          },
        },
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    })
    window.history.replaceState(null, '', '/config?configTab=active-root')
    render(<Config />)

    expect(
      screen.getByText('Planning root: /stores/shared · declared · Store shared · external')
    ).toBeTruthy()
    expect(screen.getByText('File: /stores/shared/openspec/config.yaml')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Environment Global' }))

    await waitFor(() => {
      expect(screen.getByText('/runtime/openspec/config.json', { selector: 'code' })).toBeTruthy()
    })
    expect(screen.getByText('/runtime/openspec')).toBeTruthy()
    expect(screen.getByText(/xdg-data-home/)).toBeTruthy()
  })

  it('keeps an existing empty Active Root config editable instead of rendering absence', () => {
    isStaticModeMock.mockReturnValue(false)
    activeRootConfigMock.mockReturnValue({
      data: {
        content: '',
        exists: true,
        filePath: '/stores/shared/openspec/config.yaml',
        owner: {
          kind: 'planning-root',
          path: '/stores/shared',
          source: 'declared',
          storeId: 'shared',
          externalToLaunchProject: true,
        },
      },
      isLoading: false,
      error: null,
    })
    window.history.replaceState(null, '', '/config?configTab=active-root')

    render(<Config />)

    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy()
    expect(screen.queryByText('No config file exists in the active Planning root.')).toBeNull()
  })

  it.each([
    {
      label: 'loading',
      state: {
        status: 'checking',
        disabled: true,
        context: null,
        observedAt: 0,
        title: 'Resolving planning root',
        message: 'Loading Root Context.',
        evidence: [],
      },
    },
    {
      label: 'refreshing',
      state: {
        status: 'checking',
        disabled: true,
        context: null,
        observedAt: 1,
        title: 'Refreshing planning root',
        message: 'Refreshing Root Context.',
        evidence: [],
      },
    },
    {
      label: 'transport error',
      state: {
        status: 'blocked',
        disabled: true,
        context: null,
        observedAt: 1,
        title: 'Root Context transport failed',
        message: 'Root Context transport failed.',
        evidence: [],
      },
    },
    {
      label: 'CLI error',
      state: {
        status: 'blocked',
        disabled: true,
        context: null,
        observedAt: 1,
        title: 'Planning root unavailable',
        message: 'Root Context CLI failed.',
        evidence: ['Doctor exit: 1'],
      },
    },
  ])('locks Schema and Template mutations during $label', ({ state }) => {
    isStaticModeMock.mockReturnValue(false)
    rootActionMock.mockReturnValue(state)
    configBundleMock.mockReturnValue({
      data: {
        schemas: [
          {
            name: 'project-schema',
            description: 'Project schema',
            artifacts: [],
            source: 'project',
          },
        ],
        schemaDetails: { 'project-schema': { name: 'project-schema', artifacts: [] } },
        schemaResolutions: {
          'project-schema': {
            name: 'project-schema',
            source: 'project',
            path: '/project/openspec/schemas/project-schema',
            shadows: [],
          },
        },
      },
      isLoading: false,
      error: null,
    })
    window.history.replaceState(null, '', '/config?configTab=schema:project-schema')

    render(<Config />)

    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(screen.getByRole(state.status === 'checking' ? 'status' : 'alert')).toHaveTextContent(
      state.message
    )
  })

  it('locks an already-open Schema dialog when Root Context becomes unavailable', () => {
    isStaticModeMock.mockReturnValue(false)
    configBundleMock.mockReturnValue({
      data: {
        schemas: [
          {
            name: 'project-schema',
            description: 'Project schema',
            artifacts: [],
            source: 'project',
          },
        ],
        schemaDetails: { 'project-schema': { name: 'project-schema', artifacts: [] } },
        schemaResolutions: {
          'project-schema': {
            name: 'project-schema',
            source: 'project',
            path: '/project/openspec/schemas/project-schema',
            shadows: [],
          },
        },
      },
      isLoading: false,
      error: null,
    })
    window.history.replaceState(null, '', '/config?configTab=schema:project-schema')
    const view = render(<Config />)

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByPlaceholderText('schema-name'), {
      target: { value: 'next-schema' },
    })
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()

    rootActionMock.mockReturnValue({
      status: 'blocked',
      disabled: true,
      context: null,
      observedAt: 2,
      title: 'Planning root unavailable',
      message: 'Root Context CLI failed.',
      evidence: ['Doctor exit: 1'],
    })
    view.rerender(<Config />)

    expect(screen.getByPlaceholderText('schema-name')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    expect(idleMutation.mutate).not.toHaveBeenCalled()
  })

  it('rejects a Schema mutation at its real mutation function when readiness changes before submit', async () => {
    isStaticModeMock.mockReturnValue(false)
    const mutableRootAction = {
      status: 'ready' as const,
      disabled: false,
      context: null,
      observedAt: 1,
      title: null,
      message: null as string | null,
      evidence: [],
    }
    rootActionMock.mockReturnValue(mutableRootAction)
    configBundleMock.mockReturnValue({
      data: {
        schemas: [
          {
            name: 'project-schema',
            description: 'Project schema',
            artifacts: [],
            source: 'project',
          },
        ],
        schemaDetails: { 'project-schema': { name: 'project-schema', artifacts: [] } },
        schemaResolutions: {
          'project-schema': {
            name: 'project-schema',
            source: 'project',
            path: '/project/openspec/schemas/project-schema',
            shadows: [],
          },
        },
      },
      isLoading: false,
      error: null,
    })
    window.history.replaceState(null, '', '/config?configTab=schema:project-schema')
    render(<Config />)

    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(screen.getByPlaceholderText('schema-name'), {
      target: { value: 'next-schema' },
    })
    expect(screen.getByRole('button', { name: 'Create' })).toBeEnabled()

    mutableRootAction.disabled = true
    mutableRootAction.message = 'Root Context CLI failed.'
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() =>
      expect(screen.getAllByText('Root Context CLI failed.').length).toBeGreaterThan(0)
    )
    expect(initSchemaMutateMock).not.toHaveBeenCalled()
  })
})
