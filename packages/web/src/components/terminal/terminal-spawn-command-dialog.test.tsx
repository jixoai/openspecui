/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Verify argv and shell-line terminal command creation plus advanced-field behavior.
 * 2. Verify distinct-root selection and same-root implicit or workflow-locked cwd ownership.
 * 3. Verify planning-root readiness keeps repair through the available Launch target.
 * 4. Verify workflow-bound creation opens Terminal and activates the new session.
 *
 * Original request (2026-07-16): "Terminal creation controls expose the selected cwd/root identity."
 * Owner-reported defect (2026-07-22): Creating Codex/Claude/Gemini must open Terminal when hidden.
 * Owner same-root direction (2026-07-29): hide redundant cwd switching without weakening Planning generation.
 */
import { fieldsToTerminalCommandParameters } from '@openspecui/core/terminal-invocation'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalSpawnCommandDialog } from './terminal-spawn-command-dialog'

const {
  createDedicatedSessionMock,
  getAreaForPathMock,
  getLocationMock,
  useTerminalInvocationConfigMock,
  useTerminalCwdTargetStateMock,
  vtActivateBottomMock,
  vtPushMock,
} = vi.hoisted(() => ({
  createDedicatedSessionMock: vi.fn(),
  getAreaForPathMock: vi.fn(),
  getLocationMock: vi.fn(),
  useTerminalInvocationConfigMock: vi.fn(),
  useTerminalCwdTargetStateMock: vi.fn(),
  vtActivateBottomMock: vi.fn(),
  vtPushMock: vi.fn(),
}))

vi.mock('@/lib/terminal-context', () => ({
  useTerminalContext: () => ({
    createDedicatedSession: createDedicatedSessionMock,
  }),
}))

vi.mock('@/lib/nav-controller', () => ({
  navController: { getAreaForPath: getAreaForPathMock, getLocation: getLocationMock },
}))

vi.mock('@/lib/view-transitions/navigation', () => ({
  vtNavController: { activateBottom: vtActivateBottomMock, push: vtPushMock },
}))

vi.mock('@/lib/use-terminal-invocation-config', () => ({
  useTerminalInvocationConfig: () => useTerminalInvocationConfigMock(),
}))

vi.mock('@/lib/use-terminal-cwd-target', () => ({
  useTerminalCwdTargetState: () => useTerminalCwdTargetStateMock(),
  getTerminalCwdTargetOption: (
    state: { launchProject: unknown; planningRoot: unknown },
    target: 'launch-project' | 'planning-root'
  ) => (target === 'planning-root' ? state.planningRoot : state.launchProject),
}))

describe('TerminalSpawnCommandDialog', () => {
  const shell = {
    id: 'builtin:sh',
    label: '/bin/sh',
    command: '/bin/sh',
    args: [],
    source: 'builtin' as const,
    quoteStyle: 'posix' as const,
  }

  const command = {
    id: 'builtin:claude',
    label: 'Claude',
    command: 'claude',
    args: [
      {
        kind: 'booleanFlag' as const,
        fieldId: 'dangerouslySkipPermissions',
        flag: '--dangerously-skip-permissions',
      },
      {
        kind: 'field' as const,
        fieldId: 'prompt',
        prefix: '',
        omitWhenEmpty: true,
      },
    ],
    fields: [
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea' as const,
        options: [],
        defaultValue: '',
        required: false,
        advanced: false,
      },
      {
        id: 'dangerouslySkipPermissions',
        label: 'Skip permissions',
        type: 'boolean' as const,
        options: [],
        defaultValue: false,
        required: false,
        advanced: true,
      },
    ],
    parameters: fieldsToTerminalCommandParameters([
      {
        id: 'prompt',
        label: 'Prompt',
        type: 'textarea' as const,
        options: [],
        defaultValue: '',
        required: false,
        advanced: false,
      },
      {
        id: 'dangerouslySkipPermissions',
        label: 'Skip permissions',
        type: 'boolean' as const,
        options: [],
        defaultValue: false,
        required: false,
        advanced: true,
      },
    ]),
    builder: {
      kind: 'argv' as const,
      parts: [
        { kind: 'literal' as const, value: 'claude' },
        {
          kind: 'booleanFlag' as const,
          fieldId: 'dangerouslySkipPermissions',
          flag: '--dangerously-skip-permissions',
        },
        { kind: 'field' as const, fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
      ],
    },
    source: 'builtin' as const,
  }

  beforeEach(() => {
    createDedicatedSessionMock.mockReset()
    createDedicatedSessionMock.mockReturnValue('term-1')
    getAreaForPathMock.mockReset().mockReturnValue('bottom')
    getLocationMock.mockReset().mockReturnValue({ pathname: '/' })
    vtActivateBottomMock.mockReset().mockResolvedValue(undefined)
    vtPushMock.mockReset().mockResolvedValue(undefined)
    useTerminalInvocationConfigMock.mockReturnValue({
      shellProfiles: [shell],
      defaultShellProfile: shell,
    })
    useTerminalCwdTargetStateMock.mockReturnValue({
      topology: 'distinct',
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
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('prefills prompt values and keeps dangerous flags disabled by default', () => {
    const { getByDisplayValue } = render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'draft prompt' }}
        onClose={() => {}}
      />
    )

    expect(getByDisplayValue('draft prompt')).toBeTruthy()
    const advancedButton = screen.getByRole('button', { name: /Advanced options/ })
    const advancedSectionId = advancedButton.getAttribute('aria-controls')
    if (!advancedSectionId) throw new Error('Expected advanced section id')
    const advancedSection = document.getElementById(advancedSectionId)
    if (!advancedSection) throw new Error('Expected advanced section')
    expect(advancedSection.getAttribute('aria-hidden')).toBe('true')
    expect(advancedSection.hasAttribute('inert')).toBe(true)
    expect(advancedButton.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('switch', { name: /Skip permissions/ })).toBeNull()
    expect(document.body.textContent).toContain("claude 'draft prompt'")
    expect(document.body.textContent).not.toContain('--dangerously-skip-permissions')

    fireEvent.click(advancedButton)

    expect(advancedButton.getAttribute('aria-expanded')).toBe('true')
    expect(advancedSection.getAttribute('aria-hidden')).toBe('false')
    expect(advancedSection.hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('switch', { name: /Skip permissions/ })).toBeTruthy()
  })

  it('spawns argv commands directly without typing a long command line into a shell PTY', () => {
    const onClose = vi.fn()
    const { getByText } = render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'run checks' }}
        onClose={onClose}
      />
    )

    expect(screen.getByText('/launch')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /Advanced options/ }))
    fireEvent.click(screen.getByRole('switch', { name: /Skip permissions/ }))
    fireEvent.click(getByText('Create'))

    expect(createDedicatedSessionMock).toHaveBeenCalledTimes(1)
    expect(createDedicatedSessionMock).toHaveBeenCalledWith(
      'claude',
      ['--dangerously-skip-permissions', 'run checks'],
      expect.objectContaining({
        cwdTarget: 'launch-project',
        label: 'Claude',
      })
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('executes shell-line builders through the selected shell instead of PTY input', () => {
    const shellLineCommand = {
      ...command,
      id: 'custom:shell-line',
      label: 'Shell task',
      command: 'echo',
      args: [],
      fields: [],
      parameters: undefined,
      builder: { kind: 'shellLine' as const, template: 'echo ready' },
      source: 'custom' as const,
    }
    render(<TerminalSpawnCommandDialog open command={shellLineCommand} onClose={() => undefined} />)

    fireEvent.click(screen.getByText('Create'))

    expect(createDedicatedSessionMock).toHaveBeenCalledWith('/bin/sh', ['-lc', 'echo ready'], {
      cwdTarget: 'launch-project',
      label: 'Shell task',
    })
  })

  it('opens Terminal in its current area for the created Agent session', () => {
    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'continue the change' }}
        onClose={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Create'))

    expect(getAreaForPathMock).toHaveBeenCalledWith('/terminal')
    expect(vtActivateBottomMock).toHaveBeenCalledWith('/terminal')
  })

  it('expands the bottom Terminal even when its route was already selected', () => {
    getLocationMock.mockReturnValue({ pathname: '/terminal' })
    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'continue the change' }}
        onClose={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Create'))

    expect(createDedicatedSessionMock).toHaveBeenCalledTimes(1)
    expect(vtActivateBottomMock).toHaveBeenCalledWith('/terminal')
    expect(vtPushMock).not.toHaveBeenCalled()
  })

  it('pushes Terminal when the route belongs to the main area', () => {
    getAreaForPathMock.mockReturnValue('main')
    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        presetValues={{ prompt: 'continue the change' }}
        onClose={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Create'))

    expect(vtPushMock).toHaveBeenCalledWith('main', '/terminal', null)
    expect(vtActivateBottomMock).not.toHaveBeenCalled()
  })

  it('creates the command in the selected planning root', () => {
    render(<TerminalSpawnCommandDialog open command={command} onClose={() => {}} />)

    expect(screen.getByText('/launch')).toBeVisible()
    fireEvent.click(screen.getByRole('radio', { name: 'Planning' }))
    expect(screen.getByText('/stores/shared')).toBeVisible()
    fireEvent.click(screen.getByText('Create'))

    expect(createDedicatedSessionMock).toHaveBeenCalledWith('claude', [], {
      cwdTarget: 'planning-root',
      label: 'Claude',
    })
  })

  it('locks workflow-bound creation to planning and preserves generation', () => {
    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        initialCwdTarget="planning-root"
        lockedCwdTarget="planning-root"
        expectedRootGeneration="planning-a-generation"
        onClose={() => {}}
      />
    )

    expect(screen.getByRole('radio', { name: 'Launch' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Planning' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByText('Create'))

    expect(createDedicatedSessionMock).toHaveBeenCalledWith('claude', [], {
      cwdTarget: 'planning-root',
      expectedRootGeneration: 'planning-a-generation',
      label: 'Claude',
    })
  })

  it('hides same-root selection and forces generic creation back to Launch', () => {
    useTerminalCwdTargetStateMock.mockReturnValue({
      topology: 'collapsed',
      launchProject: {
        target: 'launch-project',
        label: 'Launch project',
        path: '/workspace/project',
        available: true,
        unavailableReason: null,
      },
      planningRoot: {
        target: 'planning-root',
        label: 'Planning root',
        path: '/workspace/project',
        available: true,
        unavailableReason: null,
      },
    })

    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        initialCwdTarget="planning-root"
        onClose={() => {}}
      />
    )

    expect(screen.queryByRole('radiogroup', { name: 'Terminal working directory' })).toBeNull()
    expect(screen.queryByText('Working directory')).toBeNull()
    fireEvent.click(screen.getByText('Create'))
    expect(createDedicatedSessionMock).toHaveBeenCalledWith('claude', [], {
      cwdTarget: 'launch-project',
      label: 'Claude',
    })
  })

  it('hides same-root workflow selection while preserving Planning generation', () => {
    useTerminalCwdTargetStateMock.mockReturnValue({
      topology: 'collapsed',
      launchProject: {
        target: 'launch-project',
        label: 'Launch project',
        path: '/workspace/project',
        available: true,
        unavailableReason: null,
      },
      planningRoot: {
        target: 'planning-root',
        label: 'Planning root',
        path: '/workspace/project',
        available: true,
        unavailableReason: null,
      },
    })

    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        initialCwdTarget="planning-root"
        lockedCwdTarget="planning-root"
        expectedRootGeneration="same-root-generation"
        onClose={() => {}}
      />
    )

    expect(screen.queryByRole('radiogroup', { name: 'Terminal working directory' })).toBeNull()
    expect(screen.queryByText('Working directory')).toBeNull()
    fireEvent.click(screen.getByText('Create'))
    expect(createDedicatedSessionMock).toHaveBeenCalledWith('claude', [], {
      cwdTarget: 'planning-root',
      expectedRootGeneration: 'same-root-generation',
      label: 'Claude',
    })
  })

  it('keeps planning-root creation disabled until Root Context is current and ready', () => {
    useTerminalCwdTargetStateMock.mockReturnValue({
      topology: 'distinct',
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
        path: null,
        available: false,
        unavailableReason: 'Planning root is refreshing.',
      },
    })

    render(
      <TerminalSpawnCommandDialog
        open
        command={command}
        initialCwdTarget="planning-root"
        onClose={() => {}}
      />
    )

    const planningTarget = screen.getByRole('radio', { name: 'Planning' })
    const launchTarget = screen.getByRole('radio', { name: 'Launch' })
    const createButton = screen.getByRole('button', { name: 'Create' })

    expect(screen.getByText('Planning root is refreshing.')).toBeVisible()
    expect(planningTarget).toBeDisabled()
    expect(createButton).toBeDisabled()
    expect(launchTarget).toBeEnabled()
    fireEvent.click(launchTarget)
    expect(launchTarget).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('/launch')).toBeVisible()
    expect(createButton).toBeEnabled()
    fireEvent.click(createButton)
    expect(createDedicatedSessionMock).toHaveBeenCalledWith('claude', [], {
      cwdTarget: 'launch-project',
      label: 'Claude',
    })
  })

  it('does not close on outside dismiss requests', () => {
    const onClose = vi.fn()
    render(<TerminalSpawnCommandDialog open command={command} onClose={onClose} />)

    fireEvent.click(screen.getByRole('dialog', { hidden: true }), { clientX: 1, clientY: 1 })

    expect(onClose).not.toHaveBeenCalled()
  })
})
