import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsxVerifyRoute } from './opsx-verify'

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

vi.mock('@/lib/use-cli-runner', () => ({
  useCliRunner: () => ({
    lines: [],
    status: 'idle',
    hasStarted: false,
    commands: {
      replaceAll: vi.fn(),
      runAll: vi.fn(),
    },
    reset: vi.fn(),
    cancel: vi.fn(),
  }),
}))

vi.mock('@/lib/opsx-workflow-invocation', () => ({
  prepareWorkflowInvocation: vi.fn().mockResolvedValue({
    kind: 'cli-command',
    command: 'openspec',
    args: ['validate', 'add-terminal-spawn-command'],
    mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
  }),
  workflowDiagnosticsToText: vi.fn(() => null),
}))

vi.mock('@tanstack/react-router', () => ({
  useLocation: () => useLocationMock(),
}))

describe('OpsxVerifyRoute', () => {
  beforeEach(() => {
    setConfigMock.mockReset()
    useLocationMock.mockReturnValue({
      pathname: '/opsx-verify',
      search: '?change=add-terminal-spawn-command',
      hash: '',
      state: null,
    })
  })

  it('blocks outside dismiss for change detail verify workflow dialogs', () => {
    render(<OpsxVerifyRoute />)

    expect(setConfigMock).toHaveBeenCalledWith(expect.objectContaining({ onDismissRequest: null }))
  })
})
