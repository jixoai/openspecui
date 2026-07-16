/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Verify routed Config schema selection.
 * 2. Verify Project Binding, Active Root, and Environment Global ownership surfaces.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from './config'

const { activeRootConfigMock, configBundleMock, environmentGlobalConfigMock, isStaticModeMock } =
  vi.hoisted(() => ({
    activeRootConfigMock: vi.fn(),
    configBundleMock: vi.fn(),
    environmentGlobalConfigMock: vi.fn(),
    isStaticModeMock: vi.fn(),
  }))

const idleMutation = {
  mutate: vi.fn(),
  isPending: false,
  isSuccess: false,
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => idleMutation,
  useQuery: () => ({ data: undefined, isLoading: false, error: null, refetch: vi.fn() }),
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
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  trpc: {
    planningConfig: {
      environmentGlobal: {
        queryOptions: () => ({ queryKey: ['planningConfig.environmentGlobal'] }),
        queryFilter: () => ({ queryKey: ['planningConfig.environmentGlobal'] }),
      },
    },
    cli: {
      getProfileState: {
        queryOptions: () => ({ queryKey: ['cli.getProfileState'] }),
        queryFilter: () => ({ queryKey: ['cli.getProfileState'] }),
      },
    },
  },
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
      initSchema: { mutate: vi.fn() },
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

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => configBundleMock(),
  useOpsxSchemaFilesSubscription: () => ({ data: [], error: null }),
  useOpsxTemplateContentsSubscription: () => ({ data: {} }),
  useOpsxTemplatesSubscription: () => ({ data: {} }),
}))

describe('Config schema tabs', () => {
  beforeEach(() => {
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
      expect(screen.getByText('/runtime/openspec/config.json')).toBeTruthy()
    })
    expect(screen.getByText('/runtime/openspec')).toBeTruthy()
    expect(screen.getByText(/xdg-data-home/)).toBeTruthy()
  })
})
