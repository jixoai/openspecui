/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Exercise the Schema detail route's independent Schema-files subscription topology.
 * 2. Reach the real FileExplorer empty branches without a downstream mock.
 * 3. Preserve retained Schema-file selection when the projection has terminal error evidence.
 * 4. Distinguish initial unknown, terminal error, retained error, and settled-empty success facts.
 * 5. Keep the Schema detail workspace directly returnable to its route-owned catalog.
 *
 * Owner-reported debt (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Review finding (2026-07-23): Schema-files errors must not be projected as an empty FileExplorer.
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 * Owner Config-workbench decision (2026-08-01): preserve Schema file states inside `/config/schemas/:id`.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigSchemaWorkspace } from './config-schema-detail'

const { configBundleMock, rootActionMock, schemaFilesMock } = vi.hoisted(() => ({
  configBundleMock: vi.fn(),
  rootActionMock: vi.fn(),
  schemaFilesMock: vi.fn(),
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
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

vi.mock('@/components/context-menu', () => ({
  ContextMenu: () => null,
  ContextMenuTargeter: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/file-explorer', async () => {
  const actual = await vi.importActual<typeof import('@/components/file-explorer')>(
    '@/components/file-explorer'
  )
  return {
    ...actual,
    FileExplorerCodeEditor: ({ file }: { file: { path: string } }) => (
      <div data-testid="schema-file-editor">{file.path}</div>
    ),
  }
})

vi.mock('@/components/markdown-viewer', () => ({
  MarkdownViewer: () => <div data-testid="markdown-viewer" />,
}))

vi.mock('@/components/scroll-spy', () => ({
  useViewportConstrainedHeight: () => null,
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  }),
}))

vi.mock('@/lib/static-mode', () => ({
  getBasePath: () => '/',
  isStaticMode: () => true,
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
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
      initSchema: { mutate: vi.fn() },
      writeSchemaFile: { mutate: vi.fn() },
    },
  },
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

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => configBundleMock(),
  useOpsxSchemaFilesSubscription: () => schemaFilesMock(),
  useOpsxTemplateContentsSubscription: () => ({ data: {}, isLoading: false, error: null }),
  useOpsxTemplatesSubscription: () => ({ data: {}, isLoading: false, error: null }),
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

function renderSchemaFiles() {
  return render(<ConfigSchemaWorkspace schemaId="project-schema" onNavigate={() => undefined} />)
}

describe('Config Schema-files projection topology', () => {
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
    schemaFilesMock.mockReset().mockReturnValue({ data: [], isLoading: false, error: null })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('links the focused Schema detail workspace back to the Schema catalog', () => {
    renderSchemaFiles()

    expect(screen.getByRole('link', { name: 'Back to Schemas' })).toHaveAttribute(
      'href',
      '/config/schemas'
    )
  })

  it('shows initial Schema-files loading without mounting a false empty FileExplorer', () => {
    schemaFilesMock.mockReturnValue({ data: undefined, isLoading: true, error: null })

    const { container } = renderSchemaFiles()

    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('Loading schema files...')).toBeNull()
    expect(screen.queryByText('No files yet.')).toBeNull()
    expect(screen.queryByText('No files found for this schema.')).toBeNull()
  })

  it('shows terminal no-data Schema-files errors without loading or empty conclusions', () => {
    schemaFilesMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('schema files failed'),
    })

    renderSchemaFiles()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to load schema files: schema files failed'
    )
    expect(screen.queryByText('Loading schema files...')).toBeNull()
    expect(screen.queryByText('No files yet.')).toBeNull()
    expect(screen.queryByText('No files found for this schema.')).toBeNull()
  })

  it('keeps retained Schema files selectable beside terminal error evidence', async () => {
    schemaFilesMock.mockReturnValue({
      data: [
        { path: 'schema.yaml', type: 'file', content: 'artifacts: []\n' },
        { path: 'notes.md', type: 'file', content: '# Notes\n' },
      ],
      isLoading: false,
      error: new Error('schema files failed'),
    })

    renderSchemaFiles()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to load schema files: schema files failed'
    )
    expect(screen.queryByText('Loading schema files...')).toBeNull()
    expect(screen.queryByText('No files yet.')).toBeNull()
    expect(screen.queryByText('No files found for this schema.')).toBeNull()

    const notesButtons = await screen.findAllByRole('button', { name: 'notes.md' })
    fireEvent.click(notesButtons[0])

    await waitFor(() =>
      expect(screen.getByTestId('schema-file-editor')).toHaveTextContent('notes.md')
    )
  })

  it('shows terminal retained-empty errors without a false empty conclusion', () => {
    schemaFilesMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('schema files failed'),
    })

    renderSchemaFiles()

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Failed to load schema files: schema files failed'
    )
    expect(screen.queryByText('Loading schema files...')).toBeNull()
    expect(screen.queryByText('No files yet.')).toBeNull()
    expect(screen.queryByText('No files found for this schema.')).toBeNull()
  })

  it('keeps settled empty Schema files on the existing FileExplorer empty path', () => {
    renderSchemaFiles()

    expect(screen.getByText('No files yet.')).toBeTruthy()
    expect(screen.getByText('No files found for this schema.')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('Loading schema files...')).toBeNull()
  })
})
