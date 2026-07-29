/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Exercise the real Config writeSchemaFile mutation function through React Query.
 * 2. Prove a readiness transition blocks schema/template file writes before transport.
 * 3. Preserve the shared Root Action contract for the Schema workspace.
 *
 * Original request (2026-07-18): "Schema/Template writes require real mutation-boundary evidence."
 * Owner Context direction (2026-07-29): keep Config title actions inside the route test boundary.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from './config'

const { configBundleMock, rootActionMock, writeSchemaFileMock } = vi.hoisted(() => ({
  configBundleMock: vi.fn(),
  rootActionMock: vi.fn(),
  writeSchemaFileMock: vi.fn(),
}))

vi.mock('@/components/config/active-root-config-section', () => ({
  ActiveRootConfigSection: () => <div />,
}))
vi.mock('@/components/config/environment-global-config-section', () => ({
  EnvironmentGlobalConfigSection: () => <div />,
}))
vi.mock('@/components/config/project-binding-section', () => ({
  ProjectBindingSection: () => <div />,
}))
vi.mock('@/components/code-editor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}))
vi.mock('@/components/file-explorer', () => ({
  FileExplorer: ({
    entries,
    selectedPath,
    onSelect,
    renderEditor,
  }: {
    entries: Array<{ path: string; type: string; content?: string | null }>
    selectedPath: string | null
    onSelect: (path: string) => void
    renderEditor: (
      entry: { path: string; type: string; content?: string | null } | null
    ) => ReactNode
  }) => {
    const selected =
      entries.find((entry) => entry.path === selectedPath) ??
      entries.find((entry) => entry.type === 'file')
    return (
      <div>
        {entries.map((entry) => (
          <button key={entry.path} type="button" onClick={() => onSelect(entry.path)}>
            {entry.path}
          </button>
        ))}
        {renderEditor(selected ?? null)}
      </div>
    )
  },
  FileExplorerCodeEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string
    onChange?: (value: string) => void
    readOnly?: boolean
  }) => (
    <textarea
      aria-label="Schema file editor"
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))
vi.mock('@/components/markdown-viewer', () => ({
  MarkdownViewer: () => <div />,
}))
vi.mock('@/components/scroll-spy', () => ({
  useViewportConstrainedHeight: () => null,
}))
vi.mock('@/components/context-menu', () => ({
  ContextMenu: () => null,
  ContextMenuTargeter: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => false,
}))
vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({ createDedicatedSession: vi.fn() }),
}))
vi.mock('@/lib/nav-controller', () => ({
  navController: { getAreaForPath: () => 'main' },
}))
vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: { push: vi.fn() },
  VTLink: ({
    children,
    to,
    ...props
  }: { children?: ReactNode; to: string } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    commands: { replaceAll: vi.fn(), runAll: vi.fn() },
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}))
vi.mock('@/lib/trpc', () => ({
  trpcClient: {
    planningConfig: {
      writeActiveRoot: { mutate: vi.fn() },
      writeEnvironmentGlobal: { mutate: vi.fn() },
    },
    opsx: {
      writeSchemaFile: { mutate: writeSchemaFileMock },
      createSchemaFile: { mutate: vi.fn() },
      createSchemaDirectory: { mutate: vi.fn() },
      deleteSchemaEntry: { mutate: vi.fn() },
      initSchema: { mutate: vi.fn() },
      forkSchema: { mutate: vi.fn() },
      deleteSchema: { mutate: vi.fn() },
    },
  },
}))
vi.mock('@/lib/use-planning-config', () => ({
  useActiveRootConfigViewSubscription: () => ({ data: null, isLoading: false, error: null }),
  useEnvironmentGlobalConfigSubscription: () => ({
    data: null,
    isLoading: false,
    error: null,
    refresh: vi.fn(),
  }),
  useProjectBindingSubscription: () => ({ data: null, isLoading: false, error: null }),
}))
vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))
vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => configBundleMock(),
  useOpsxSchemaFilesSubscription: () => ({
    data: [{ path: 'schema.yaml', type: 'file', content: 'artifacts: []\n' }],
    error: null,
  }),
  useOpsxTemplateContentsSubscription: () => ({ data: {} }),
  useOpsxTemplatesSubscription: () => ({ data: {} }),
}))

const readyRootAction = {
  status: 'ready' as const,
  disabled: false,
  context: null,
  observedAt: 1,
  title: null,
  message: null as string | null,
  evidence: [],
}

function renderConfig() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Config />
    </QueryClientProvider>
  )
  return { queryClient, view }
}

describe('Config Schema file mutation boundary', () => {
  beforeEach(() => {
    rootActionMock.mockReset().mockReturnValue(readyRootAction)
    configBundleMock.mockReset().mockReturnValue({
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
    writeSchemaFileMock.mockReset().mockResolvedValue(undefined)
    window.history.replaceState(null, '', '/config?configTab=schema:project-schema')
  })

  afterEach(() => cleanup())

  it('rejects a real writeSchemaFile mutation after readiness changes before mutationFn runs', async () => {
    const { queryClient, view } = renderConfig()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Schema file editor'), {
      target: { value: 'artifacts: [changed]\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    rootActionMock.mockReturnValue({
      ...readyRootAction,
      status: 'blocked',
      disabled: true,
      message: 'Planning root changed before schema write.',
    })
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <Config />
      </QueryClientProvider>
    )

    await waitFor(() =>
      expect(screen.getByText('Planning root changed before schema write.')).toBeTruthy()
    )
    expect(writeSchemaFileMock).not.toHaveBeenCalled()
  })
})
