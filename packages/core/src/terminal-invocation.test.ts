import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TERMINAL_SPAWN_COMMANDS,
  fieldsToTerminalCommandParameters,
  getTerminalCommandDefaultValues,
  renderTerminalCommandArgs,
  renderTerminalSpawnCommand,
  renderTerminalSpawnCommandLine,
  resolveTerminalShellDefaults,
  type TerminalSpawnCommand,
} from './terminal-invocation.js'

describe('resolveTerminalShellDefaults', () => {
  it('uses SHELL as effective default and keeps /bin/sh as a builtin on unix-like platforms', () => {
    const defaults = resolveTerminalShellDefaults({
      platform: 'macos',
      env: { SHELL: '/bin/zsh' },
    })

    expect(defaults.effectiveDefaultShell.command).toBe('/bin/zsh')
    expect(defaults.builtinShellProfiles.map((profile) => profile.command)).toEqual([
      '/bin/sh',
      '/bin/zsh',
    ])
  })

  it('falls back to /bin/sh when SHELL is unavailable', () => {
    const defaults = resolveTerminalShellDefaults({
      platform: 'common',
      env: {},
    })

    expect(defaults.effectiveDefaultShell).toMatchObject({
      id: 'builtin:sh',
      command: '/bin/sh',
    })
  })

  it('does not require a Node process global when env is omitted', () => {
    const processDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'process')
    try {
      Reflect.deleteProperty(globalThis, 'process')

      const defaults = resolveTerminalShellDefaults({
        platform: 'common',
      })

      expect(defaults.effectiveDefaultShell).toMatchObject({
        id: 'builtin:sh',
        command: '/bin/sh',
      })
    } finally {
      if (processDescriptor) {
        Object.defineProperty(globalThis, 'process', processDescriptor)
      }
    }
  })

  it('uses ComSpec as the Windows cmd profile and offers PowerShell plus WSL bash', () => {
    const defaults = resolveTerminalShellDefaults({
      platform: 'windows',
      env: { ComSpec: 'C:\\Windows\\System32\\cmd.exe' },
    })

    expect(defaults.effectiveDefaultShell.command).toBe('C:\\Windows\\System32\\cmd.exe')
    expect(defaults.builtinShellProfiles.map((profile) => profile.id)).toEqual([
      'builtin:cmd',
      'builtin:powershell',
      'builtin:wsl-bash',
    ])
  })
})

describe('terminal spawn commands', () => {
  it('keeps Claude unsafe permission flag disabled by default', () => {
    const claude = BUILTIN_TERMINAL_SPAWN_COMMANDS.find(
      (command) => command.id === 'builtin:claude'
    )
    expect(claude).toBeDefined()
    if (!claude) return

    const values = getTerminalCommandDefaultValues(claude, { prompt: 'hello' })

    expect(values.dangerouslySkipPermissions).toBe(false)
    expect(renderTerminalCommandArgs(claude, values)).toEqual(['hello'])
  })

  it('renders boolean flags only when explicitly enabled', () => {
    const claude = BUILTIN_TERMINAL_SPAWN_COMMANDS.find(
      (command) => command.id === 'builtin:claude'
    )
    expect(claude).toBeDefined()
    if (!claude) return

    const values = getTerminalCommandDefaultValues(claude, {
      prompt: 'do work',
      dangerouslySkipPermissions: true,
    })

    expect(renderTerminalCommandArgs(claude, values)).toEqual([
      '--dangerously-skip-permissions',
      'do work',
    ])
  })

  it('marks built-in risky and lower-frequency command fields as advanced', () => {
    const commands = Object.fromEntries(
      BUILTIN_TERMINAL_SPAWN_COMMANDS.map((command) => [command.id, command])
    )

    expect(
      commands['builtin:claude']?.fields.find((field) => field.id === 'dangerouslySkipPermissions')
    ).toMatchObject({ advanced: true })
    expect(
      commands['builtin:codex']?.fields.find(
        (field) => field.id === 'dangerouslyBypassApprovalsAndSandbox'
      )
    ).toMatchObject({ advanced: true })
    expect(commands['builtin:gemini']?.fields.find((field) => field.id === 'yolo')).toMatchObject({
      advanced: true,
    })
  })

  it('renders common Codex options and keeps dangerous bypass disabled by default', () => {
    const codex = BUILTIN_TERMINAL_SPAWN_COMMANDS.find((command) => command.id === 'builtin:codex')
    expect(codex).toBeDefined()
    if (!codex) return

    const defaults = getTerminalCommandDefaultValues(codex, {
      prompt: 'build feature',
      model: 'gpt-5.5',
      sandbox: 'workspace-write',
      approvalPolicy: 'on-request',
      search: true,
    })

    expect(defaults.dangerouslyBypassApprovalsAndSandbox).toBe(false)
    expect(renderTerminalSpawnCommand({ command: codex, values: defaults })).toEqual({
      kind: 'argv',
      argv: [
        'codex',
        '--model=gpt-5.5',
        '--sandbox=workspace-write',
        '--ask-for-approval=on-request',
        '--search',
        'build feature',
      ],
    })
  })

  it('renders common Gemini options and keeps yolo disabled by default', () => {
    const gemini = BUILTIN_TERMINAL_SPAWN_COMMANDS.find(
      (command) => command.id === 'builtin:gemini'
    )
    expect(gemini).toBeDefined()
    if (!gemini) return

    const defaults = getTerminalCommandDefaultValues(gemini, {
      prompt: 'inspect app',
      model: 'gemini-pro',
      approvalMode: 'auto_edit',
      sandbox: true,
    })

    expect(defaults.yolo).toBe(false)
    expect(renderTerminalSpawnCommand({ command: gemini, values: defaults })).toEqual({
      kind: 'argv',
      argv: [
        'gemini',
        '--model=gemini-pro',
        '--approval-mode=auto_edit',
        '--sandbox',
        'inspect app',
      ],
    })
  })

  it('quotes rendered shell lines according to shell profile quote style', () => {
    const codex = BUILTIN_TERMINAL_SPAWN_COMMANDS.find((command) => command.id === 'builtin:codex')
    expect(codex).toBeDefined()
    if (!codex) return

    const values = getTerminalCommandDefaultValues(codex, {
      prompt: "write 'safe' code",
    })

    expect(
      renderTerminalSpawnCommandLine({
        command: codex,
        values,
        quoteStyle: 'posix',
      })
    ).toBe("codex 'write '\\''safe'\\'' code'")
  })

  it('renders argv builders from JSON-schema parameters', () => {
    const command: TerminalSpawnCommand = {
      id: 'custom:test',
      label: 'Test',
      command: 'runner',
      args: [],
      fields: [
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          options: ['fast', 'safe'],
          defaultValue: 'fast',
          required: false,
        },
      ],
      parameters: fieldsToTerminalCommandParameters([
        {
          id: 'mode',
          label: 'Mode',
          type: 'select',
          options: ['fast', 'safe'],
          defaultValue: 'fast',
          required: false,
        },
      ]),
      builder: {
        kind: 'argv',
        parts: [
          { kind: 'literal', value: 'runner' },
          { kind: 'field', fieldId: 'mode', prefix: '--mode=', omitWhenEmpty: true },
        ],
      },
      source: 'custom',
    }

    const values = getTerminalCommandDefaultValues(command)

    expect(renderTerminalSpawnCommand({ command, values })).toEqual({
      kind: 'argv',
      argv: ['runner', '--mode=fast'],
    })
  })

  it('renders shellLine builders without argv quoting', () => {
    const command: TerminalSpawnCommand = {
      id: 'custom:shell-line',
      label: 'Shell Line',
      command: 'echo',
      args: [],
      fields: [
        {
          id: 'payload',
          label: 'Payload',
          type: 'text',
          options: [],
          defaultValue: 'hello world',
          required: false,
        },
      ],
      parameters: fieldsToTerminalCommandParameters([
        {
          id: 'payload',
          label: 'Payload',
          type: 'text',
          options: [],
          defaultValue: 'hello world',
          required: false,
        },
      ]),
      builder: {
        kind: 'shellLine',
        template: 'echo {{payload}}',
      },
      source: 'custom',
    }

    expect(
      renderTerminalSpawnCommandLine({
        command,
        values: getTerminalCommandDefaultValues(command),
        quoteStyle: 'posix',
      })
    ).toBe('echo hello world')
  })
})
