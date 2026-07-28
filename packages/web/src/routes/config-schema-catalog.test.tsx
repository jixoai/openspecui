/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Prove the Config-owned Schema catalog status host remains available outside dynamic Schema tabs.
 * 2. Distinguish catalog loading, terminal errors, retained data, and a settled empty catalog.
 * 3. Keep the selected-Schema files projection current so this fixture proves only catalog/tab ownership.
 *
 * Original owner report (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等，给我的感觉就是非常卡。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）"
 */
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Config } from './config'

const { configBundleMock, rootActionMock, schemaFilesMock } = vi.hoisted(() => ({
  configBundleMock: vi.fn(),
  rootActionMock: vi.fn(),
  schemaFilesMock: vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
  }),
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}))

vi.mock('@/components/config/active-root-config-section', () => ({
  ActiveRootConfigSection: () => <div>Active Root content</div>,
}))

vi.mock('@/components/config/environment-global-config-section', () => ({
  EnvironmentGlobalConfigSection: () => <div>Environment Global content</div>,
}))

vi.mock('@/components/config/project-binding-section', () => ({
  ProjectBindingSection: () => <div>Project Binding content</div>,
}))

vi.mock('@/components/context-menu', () => ({
  ContextMenu: () => null,
  ContextMenuTargeter: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuWrapper: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/file-explorer', () => ({
  FileExplorer: () => <div data-testid="schema-file-explorer">Schema file explorer</div>,
  FileExplorerCodeEditor: () => <div data-testid="schema-file-editor" />,
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

vi.mock('@/lib/use-opsx', () => ({
  useOpsxConfigBundleSubscription: () => configBundleMock(),
  useOpsxSchemaFilesSubscription: (schema: string | undefined) => schemaFilesMock(schema),
  useOpsxTemplateContentsSubscription: () => ({ data: {}, isLoading: false, error: null }),
  useOpsxTemplatesSubscription: () => ({ data: {}, isLoading: false, error: null }),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: rootActionMock,
}))

function currentSchemaCatalog(schemaNames: readonly string[]) {
  const schemas = schemaNames.map((name) => ({
    name,
    description: `${name} schema`,
    artifacts: [],
    source: 'project',
  }))

  return {
    data: {
      schemas,
      schemaDetails: Object.fromEntries(schemaNames.map((name) => [name, { name, artifacts: [] }])),
      schemaResolutions: Object.fromEntries(
        schemaNames.map((name) => [
          name,
          {
            name,
            source: 'project',
            path: `/project/openspec/schemas/${name}`,
            shadows: [],
          },
        ])
      ),
    },
    isLoading: false,
    error: null,
  }
}

function renderConfigAt(tab = 'project-binding') {
  window.history.replaceState(null, '', `/config?configTab=${tab}`)
  return render(<Config />)
}

function expectFixedConfigTabs() {
  expect(screen.getByRole('button', { name: 'Project Binding' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Active Root' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Environment Global' })).toBeTruthy()
}

describe('Config Schema catalog/tab inventory topology', () => {
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
    configBundleMock.mockReset()
    schemaFilesMock.mockReset().mockReturnValue({ data: [], isLoading: false, error: null })
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows catalog loading from the mounted status host without inventing a Schema tab or empty state', () => {
    configBundleMock.mockReturnValue({ data: undefined, isLoading: true, error: null })

    const { container } = renderConfigAt()

    expectFixedConfigTabs()
    expect(container.querySelector('.rt-skeleton')).not.toBeNull()
    expect(screen.queryByText('Loading schemas...')).toBeNull()
    expect(screen.queryByRole('button', { name: /Schema\(/ })).toBeNull()
    expect(screen.queryByText('No schemas available.')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a terminal absent-catalog error without loading, Schema tabs, or an empty conclusion', () => {
    configBundleMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('schemas failed'),
    })

    renderConfigAt()

    expectFixedConfigTabs()
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load schemas: schemas failed')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: /Schema\(/ })).toBeNull()
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('keeps retained Schema tabs and selected Schema content beside a terminal catalog error', () => {
    configBundleMock.mockReturnValue({
      ...currentSchemaCatalog(['project-schema']),
      error: new Error('schemas failed'),
    })

    renderConfigAt('schema:project-schema')

    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load schemas: schemas failed')
    expect(screen.getByRole('button', { name: 'Schema(project-schema)' })).toHaveClass(
      'tab-selected'
    )
    expect(screen.getByTestId('schema-file-explorer')).toHaveTextContent('Schema file explorer')
    expect(schemaFilesMock).toHaveBeenLastCalledWith('project-schema')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('shows a retained-empty catalog error without loading, Schema tabs, or an empty conclusion', () => {
    configBundleMock.mockReturnValue({
      ...currentSchemaCatalog([]),
      error: new Error('schemas failed'),
    })

    renderConfigAt()

    expectFixedConfigTabs()
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load schemas: schemas failed')
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('button', { name: /Schema\(/ })).toBeNull()
    expect(screen.queryByText('No schemas available.')).toBeNull()
  })

  it('shows the settled empty catalog state from the status host without a Schema tab', () => {
    configBundleMock.mockReturnValue(currentSchemaCatalog([]))

    renderConfigAt()

    expectFixedConfigTabs()
    expect(screen.getByText('No schemas available.')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button', { name: /Schema\(/ })).toBeNull()
  })
})
