import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxComposeRoute } from './opsx-compose'

const { setConfigMock, useLocationMock } = vi.hoisted(() => ({
  setConfigMock: vi.fn(),
  useLocationMock: vi.fn(),
}))

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

vi.mock('@/lib/terminal-controller', () => ({
  terminalController: {
    writeToSession: vi.fn(),
    addInputHistory: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/lib/use-subscription', () => ({
  useConfigSubscription: () => ({
    data: { opsx: { agentInvocationMode: 'compose' } },
  }),
}))

vi.mock('@/lib/opsx-workflow-invocation', () => ({
  prepareWorkflowInvocation: vi.fn().mockResolvedValue({
    kind: 'agent-prompt',
    text: 'prepared prompt',
    format: 'markdown',
    mode: { requestedMode: 'compose', actualMode: 'compose', fallbackReason: null },
  }),
  stringifyWorkflowInvocation: vi.fn(() => 'prepared prompt'),
  workflowDiagnosticsToText: vi.fn(() => null),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

describe('OpsxComposeRoute', () => {
  beforeEach(() => {
    setConfigMock.mockReset()
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
})
