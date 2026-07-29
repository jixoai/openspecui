/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove late Root A preparation cannot overwrite a B-current target or A-owned dirty draft.
 * 2. Prove same-generation observations preserve the real editor and spawn-dialog instances.
 * 3. Prove pending preparation uses the shared visual cue without routine visible copy.
 *
 * Original request (2026-07-21): "Compose 需要先建模 pending A -> B 的 generation；不要用假按钮、手动 downstream 调用或同时绕过两层保护。"
 * Owner correction (2026-07-21): "每项先明确一个生产 owner、一个精准红例、一个绿例。"
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下）。"
 * Original request (2026-07-28): keep workflow evidence retrievable while removing verbose direct labels.
 */
import { EditorView } from '@codemirror/view'
import type { RunWorkflowResultV2, WorkflowInvocationTargetV2 } from '@openspecui/core'
import type {
  TerminalShellProfile,
  TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxComposeRoute } from './opsx-compose'

const ROOT_A_TARGET = {
  launchProject: { path: '/launch' },
  planningRoot: {
    path: '/stores/shared',
    source: 'store',
    store_id: 'shared',
    healthy: true,
    status: [],
  },
  storeId: 'shared',
  observedAt: 1,
  generation: 'planning-shared-generation',
  rootSelector: { store: 'shared' },
  references: [],
  diagnostics: { root: [], doctor: [], context: [] },
  rootEvidence: { doctor: null, context: null },
} satisfies WorkflowInvocationTargetV2

const ROOT_B_TARGET = {
  ...ROOT_A_TARGET,
  planningRoot: {
    ...ROOT_A_TARGET.planningRoot,
    path: '/stores/next',
    store_id: 'next',
  },
  storeId: 'next',
  observedAt: 2,
  generation: 'planning-next-generation',
  rootSelector: { store: 'next' },
} satisfies WorkflowInvocationTargetV2

const TEST_SHELL = {
  id: 'builtin:zsh',
  label: 'zsh',
  command: 'zsh',
  args: [],
  source: 'builtin',
  quoteStyle: 'posix',
} satisfies TerminalShellProfile

const TEST_COMMAND = {
  id: 'builtin:claude',
  label: 'Claude',
  command: 'claude',
  args: [
    {
      kind: 'field',
      fieldId: 'prompt',
      prefix: '',
      omitWhenEmpty: true,
    },
  ],
  fields: [
    {
      id: 'prompt',
      label: 'Prompt',
      type: 'textarea',
      options: [],
      defaultValue: '',
      required: false,
      advanced: false,
    },
  ],
  source: 'builtin',
} satisfies TerminalSpawnCommand

const {
  addInputHistoryMock,
  createDedicatedSessionMock,
  prepareWorkflowInvocationMock,
  rootActionMock,
  setConfigMock,
  uiConfigMock,
  useLocationMock,
} = vi.hoisted(() => ({
  addInputHistoryMock: vi.fn(),
  createDedicatedSessionMock: vi.fn(),
  prepareWorkflowInvocationMock: vi.fn(),
  rootActionMock: vi.fn(),
  setConfigMock: vi.fn(),
  uiConfigMock: vi.fn(),
  useLocationMock: vi.fn(),
}))

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({ setConfig: setConfigMock }),
  usePopAreaLifecycleContext: () => ({ requestClose: vi.fn() }),
}))

// The Markdown decoration extension emits browser-valid escaped selectors that jsdom's selector
// engine cannot parse. It is visual-only and is not part of Compose draft ownership.
vi.mock('@/lib/codemirror-markdown-preview', () => ({
  markdownPreview: () => [],
}))

// Third-party theme selectors also depend on a browser CSS engine. The editor state/view and
// controlled onChange path remain real; only visual theme extensions are neutralized in jsdom.
vi.mock('@fsegurai/codemirror-theme-bundle', () => ({
  githubDark: [],
  githubLight: [],
  gruvboxDark: [],
  gruvboxLight: [],
  materialDark: [],
  materialLight: [],
  monokai: [],
  nord: [],
  tokyoNightDay: [],
  tokyoNightStorm: [],
  vsCodeDark: [],
  vsCodeLight: [],
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    sessions: [],
    activeSessionId: null,
    createDedicatedSession: createDedicatedSessionMock,
  }),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => ({
    shellProfiles: [TEST_SHELL],
    defaultShellProfile: TEST_SHELL,
    spawnCommands: [TEST_COMMAND],
  }),
}))

vi.mock('@/lib/use-terminal-cwd-target', () => ({
  useTerminalCwdTargetState: () => ({
    launchProject: {
      target: 'launch-project',
      label: 'Launch project',
      path: '/launch',
      available: true,
      unavailableReason: null,
    },
    planningRoot: {
      target: 'planning-root',
      label: 'Planning root',
      path: '/stores/shared',
      available: true,
      unavailableReason: null,
    },
  }),
  getTerminalCwdTargetOption: (
    state: { launchProject: unknown; planningRoot: unknown },
    target: 'launch-project' | 'planning-root'
  ) => (target === 'planning-root' ? state.planningRoot : state.launchProject),
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    writeToSession: vi.fn(),
    addInputHistory: addInputHistoryMock,
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => uiConfigMock(),
}))

vi.mock('@/lib/use-root-action-state', () => ({
  useRootActionState: () => rootActionMock(),
}))

vi.mock('@/lib/opsx-workflow-invocation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/opsx-workflow-invocation')>()
  return {
    ...actual,
    prepareWorkflowInvocation: prepareWorkflowInvocationMock,
    stringifyWorkflowInvocation: vi.fn((result: { text: string }) => result.text),
    workflowDiagnosticsToText: vi.fn(() => null),
  }
})

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

function readyRoot(target: WorkflowInvocationTargetV2, observedAt = target.observedAt) {
  return {
    status: 'ready' as const,
    disabled: false,
    context: {
      planningRoot: target.planningRoot,
      storeId: target.storeId,
      generation: target.generation,
      observedAt,
    },
    observedAt,
    title: null,
    message: null,
    evidence: [],
  }
}

function deferred<T>() {
  let resolvePromise: ((value: T) => void) | null = null
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })
  return {
    promise,
    resolve(value: T) {
      if (!resolvePromise) throw new Error('Deferred promise resolver is not ready.')
      resolvePromise(value)
    },
  }
}

function workflowResult(text: string, target: WorkflowInvocationTargetV2): RunWorkflowResultV2 {
  return {
    kind: 'agent-prompt',
    text,
    format: 'markdown',
    mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
    target,
    evidence: null,
  }
}

function getComposeEditorView(): EditorView {
  const editorDom = document.querySelector<HTMLElement>('.cm-editor')
  if (!editorDom) throw new Error('Expected the mounted Compose CodeEditor.')
  const editor = EditorView.findFromDOM(editorDom)
  if (!editor) throw new Error('Expected the mounted Compose EditorView.')
  return editor
}

function getWorkflowTargetNotice(): HTMLElement {
  return screen.getByRole('region', { name: 'Workflow target' })
}

function replaceComposeDraft(editor: EditorView, value: string): void {
  act(() => {
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: value },
    })
  })
}

const originalRangeGetClientRects = Object.getOwnPropertyDescriptor(
  Range.prototype,
  'getClientRects'
)
const originalRangeGetBoundingClientRect = Object.getOwnPropertyDescriptor(
  Range.prototype,
  'getBoundingClientRect'
)

describe('OpsxComposeRoute generation ownership', () => {
  beforeAll(() => {
    Object.defineProperties(Range.prototype, {
      getClientRects: {
        configurable: true,
        value: () => document.body.getClientRects(),
      },
      getBoundingClientRect: {
        configurable: true,
        value: () => new DOMRect(),
      },
    })
  })

  beforeEach(() => {
    addInputHistoryMock.mockReset().mockResolvedValue(undefined)
    createDedicatedSessionMock.mockReset().mockReturnValue('term-created')
    prepareWorkflowInvocationMock.mockReset()
    rootActionMock.mockReset().mockReturnValue(readyRoot(ROOT_A_TARGET))
    setConfigMock.mockReset()
    uiConfigMock.mockReset().mockReturnValue({
      data: { opsx: { agentInvocationMode: 'compose' } },
    })
    useLocationMock.mockReset().mockReturnValue({
      pathname: '/opsx-compose',
      search: '?action=archive&change=add-terminal-spawn-command',
      hash: '',
      state: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  afterAll(() => {
    if (originalRangeGetClientRects) {
      Object.defineProperty(Range.prototype, 'getClientRects', originalRangeGetClientRects)
    } else {
      Reflect.deleteProperty(Range.prototype, 'getClientRects')
    }
    if (originalRangeGetBoundingClientRect) {
      Object.defineProperty(
        Range.prototype,
        'getBoundingClientRect',
        originalRangeGetBoundingClientRect
      )
    } else {
      Reflect.deleteProperty(Range.prototype, 'getBoundingClientRect')
    }
  })

  it('keeps B authoritative when pending Root A resolves after B', async () => {
    const prepareA = deferred<RunWorkflowResultV2>()
    const prepareB = deferred<RunWorkflowResultV2>()
    prepareWorkflowInvocationMock
      .mockImplementationOnce(() => prepareA.promise)
      .mockImplementationOnce(() => prepareB.promise)

    const view = render(<OpsxComposeRoute />)
    await waitFor(() => expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(1))
    expect(view.container.querySelector('.rt-revalidate-cue')).not.toBeNull()
    expect(screen.queryByText('Generating prompt...')).toBeNull()
    const editor = getComposeEditorView()
    replaceComposeDraft(editor, 'edited while Root A is pending')
    expect(editor.state.doc.toString()).toBe('edited while Root A is pending')

    rootActionMock.mockReturnValue(readyRoot(ROOT_B_TARGET))
    view.rerender(<OpsxComposeRoute />)
    await waitFor(() => expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(2))

    await act(async () => {
      prepareB.resolve(workflowResult('prepared Root B prompt', ROOT_B_TARGET))
      await prepareB.promise
    })
    await waitFor(() =>
      expect(within(getWorkflowTargetNotice()).getByText('/stores/next')).toBeInTheDocument()
    )
    expect(getComposeEditorView()).toBe(editor)
    expect(editor.state.doc.toString()).toBe('edited while Root A is pending')
    expect(screen.getByRole('button', { name: 'Use edited prompt for current root' })).toBeVisible()

    await act(async () => {
      prepareA.resolve(workflowResult('stale Root A prompt', ROOT_A_TARGET))
      await prepareA.promise
    })

    expect(within(getWorkflowTargetNotice()).getByText('/stores/next')).toBeInTheDocument()
    expect(within(getWorkflowTargetNotice()).queryByText('/stores/shared')).not.toBeInTheDocument()
    expect(editor.state.doc.toString()).toBe('edited while Root A is pending')
    expect(screen.getByRole('button', { name: 'Use edited prompt for current root' })).toBeVisible()
    expect(addInputHistoryMock).not.toHaveBeenCalled()
    expect(createDedicatedSessionMock).not.toHaveBeenCalled()
  })

  it('preserves the real editor and dialog across same-generation observedAt refresh', async () => {
    prepareWorkflowInvocationMock.mockResolvedValue(
      workflowResult('prepared Root A prompt', ROOT_A_TARGET)
    )

    const view = render(<OpsxComposeRoute />)
    await waitFor(() =>
      expect(within(getWorkflowTargetNotice()).getByText('/stores/shared')).toBeInTheDocument()
    )
    const editor = getComposeEditorView()
    replaceComposeDraft(editor, 'same-generation dirty draft')

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))
    const dialog = await screen.findByRole('dialog', { name: 'Create Claude' })
    expect(await within(dialog).findByDisplayValue('same-generation dirty draft')).toBeVisible()

    rootActionMock.mockReturnValue(readyRoot(ROOT_A_TARGET, 2))
    view.rerender(<OpsxComposeRoute />)

    expect(getComposeEditorView()).toBe(editor)
    expect(editor.state.doc.toString()).toBe('same-generation dirty draft')
    expect(screen.getByRole('dialog', { name: 'Create Claude' })).toBe(dialog)
    expect(within(dialog).getByDisplayValue('same-generation dirty draft')).toBeVisible()
    expect(screen.queryByText('Planning root changed')).not.toBeInTheDocument()
    expect(prepareWorkflowInvocationMock).toHaveBeenCalledTimes(1)
  })
})
