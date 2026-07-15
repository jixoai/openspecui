/**
 * Orthogonal intents (updated 2026-07-15 Asia/Shanghai):
 * 1. Verify the change workflow dialog preserves route action and invocation-mode inputs.
 * 2. Verify the shared terminal dispatch surface remains available.
 *
 * Original request (2026-07-15): "sync、update 的完整交付链。"
 */
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxComposeRoute } from './opsx-compose'

const { prepareWorkflowInvocationMock, setConfigMock, uiConfigMock, useLocationMock } = vi.hoisted(
  () => ({
    prepareWorkflowInvocationMock: vi.fn(),
    setConfigMock: vi.fn(),
    uiConfigMock: vi.fn(),
    useLocationMock: vi.fn(),
  })
)

vi.mock('@/components/layout/pop-area', () => ({
  usePopAreaConfigContext: () => ({
    setConfig: setConfigMock,
  }),
  usePopAreaLifecycleContext: () => ({
    requestClose: vi.fn(),
  }),
}))

vi.mock('@/components/code-editor', () => ({
  CodeEditor: ({ value }: { value: string }) => (
    <textarea aria-label="Prompt" value={value} readOnly />
  ),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    sessions: [],
    activeSessionId: null,
  }),
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => ({
    shellProfiles: [
      {
        id: 'builtin:zsh',
        label: 'zsh',
        command: 'zsh',
        args: [],
        source: 'builtin',
        quoteStyle: 'posix',
      },
    ],
    defaultShellProfile: {
      id: 'builtin:zsh',
      label: 'zsh',
      command: 'zsh',
      args: [],
      source: 'builtin',
      quoteStyle: 'posix',
    },
    spawnCommands: [
      {
        id: 'builtin:claude',
        label: 'Claude',
        command: 'claude',
        args: [],
        fields: [],
        source: 'builtin',
      },
    ],
  }),
}))

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    writeToSession: vi.fn(),
    addInputHistory: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => uiConfigMock(),
}))

vi.mock('@/lib/opsx-workflow-invocation', () => ({
  prepareWorkflowInvocation: prepareWorkflowInvocationMock,
  stringifyWorkflowInvocation: vi.fn((result: { text: string }) => result.text),
  workflowDiagnosticsToText: vi.fn(() => null),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

describe('OpsxComposeRoute', () => {
  beforeEach(() => {
    prepareWorkflowInvocationMock.mockReset().mockResolvedValue({
      kind: 'agent-prompt',
      text: 'prepared prompt',
      format: 'markdown',
      mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
    })
    setConfigMock.mockReset()
    uiConfigMock.mockReset().mockReturnValue({
      data: { opsx: { agentInvocationMode: 'compose' } },
    })
    useLocationMock.mockReturnValue({
      pathname: '/opsx-compose',
      search: '?action=archive&change=add-terminal-spawn-command',
      hash: '',
      state: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('blocks outside dismiss for change detail compose workflow dialogs', async () => {
    render(<OpsxComposeRoute />)

    expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ onDismissRequest: null }))
    await waitFor(() => {
      expect(screen.getByLabelText('Prompt')).toHaveValue('prepared prompt')
    })
  })

  it('uses shared terminal dispatch actions with create targets', async () => {
    render(<OpsxComposeRoute />)

    await waitFor(() => {
      expect(screen.getByTestId('terminal-dispatch-target-select').textContent).toContain(
        'Create Claude'
      )
    })
  })

  it.each(['update', 'sync'] as const)(
    'passes the %s action through command-mode workflow preparation',
    async (action) => {
      uiConfigMock.mockReturnValue({
        data: { opsx: { agentInvocationMode: 'command' } },
      })
      useLocationMock.mockReturnValue({
        pathname: '/opsx-compose',
        search: `?action=${action}&change=add-search`,
        hash: '',
        state: null,
      })
      prepareWorkflowInvocationMock.mockResolvedValue({
        kind: 'agent-command',
        text: `/opsx:${action} add-search`,
        mode: { requestedMode: 'command', actualMode: 'command', fallbackReason: null },
      })

      render(<OpsxComposeRoute />)

      await waitFor(() => {
        expect(prepareWorkflowInvocationMock).toHaveBeenCalledWith({
          requestedMode: 'command',
          workflowInput: { action, changeId: 'add-search' },
          staticFallback: expect.any(Function),
        })
      })
      expect(screen.getByLabelText('Prompt')).toHaveValue(`/opsx:${action} add-search`)
    }
  )
})
