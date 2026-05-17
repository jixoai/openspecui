import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from './config'

const { configBundleMock } = vi.hoisted(() => ({
  configBundleMock: vi.fn(),
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
  isStaticMode: () => true,
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({ createDedicatedSession: vi.fn() }),
}))

vi.mock('@/lib/trpc', () => ({
  queryClient: {
    invalidateQueries: vi.fn(),
  },
  trpc: {
    cli: {
      getGlobalConfig: {
        queryOptions: () => ({ queryKey: ['cli.getGlobalConfig'] }),
        queryFilter: () => ({ queryKey: ['cli.getGlobalConfig'] }),
      },
      getGlobalConfigPath: {
        queryOptions: () => ({ queryKey: ['cli.getGlobalConfigPath'] }),
        queryFilter: () => ({ queryKey: ['cli.getGlobalConfigPath'] }),
      },
      getProfileState: {
        queryOptions: () => ({ queryKey: ['cli.getProfileState'] }),
        queryFilter: () => ({ queryKey: ['cli.getProfileState'] }),
      },
    },
  },
  trpcClient: {
    cli: {
      execute: {
        mutate: vi.fn(),
      },
    },
    opsx: {
      createSchemaDirectory: { mutate: vi.fn() },
      createSchemaFile: { mutate: vi.fn() },
      deleteSchema: { mutate: vi.fn() },
      deleteSchemaEntry: { mutate: vi.fn() },
      writeProjectConfig: { mutate: vi.fn() },
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

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => configBundleMock(),
  useOpsxProjectConfigSubscription: () => ({ data: 'schema: spec-driven', isLoading: false }),
  useOpsxSchemaFilesSubscription: () => ({ data: [], error: null }),
  useOpsxTemplateContentsSubscription: () => ({ data: {} }),
  useOpsxTemplatesSubscription: () => ({ data: {} }),
}))

describe('Config schema tabs', () => {
  beforeEach(() => {
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
      expect(window.location.search).toBe('?configTab=schema%3Aspec-driven')
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
})
