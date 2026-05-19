const TERMINAL_TARGET_PREFIX = 'terminal:'
const CREATE_TARGET_PREFIX = 'create:'

const SHELL_PROCESS_NAMES = new Set([
  'bash',
  'zsh',
  'fish',
  'sh',
  'dash',
  'ksh',
  'cmd.exe',
  'cmd',
  'powershell.exe',
  'powershell',
  'pwsh.exe',
  'pwsh',
  'nu',
  'nushell',
])

export type ExistingTerminalTarget = `${typeof TERMINAL_TARGET_PREFIX}${string}`
export type CreateTerminalTarget = `${typeof CREATE_TARGET_PREFIX}${string}`
export type TerminalDispatchTarget = ExistingTerminalTarget | CreateTerminalTarget
export type TerminalDispatchSelectValue = TerminalDispatchTarget | ''

export interface SanitizedTerminalPayload {
  text: string
  modified: boolean
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function parseTerminalTarget(target: string | null | undefined): string | null {
  if (!target?.startsWith(TERMINAL_TARGET_PREFIX)) return null
  return target.slice(TERMINAL_TARGET_PREFIX.length)
}

export function parseCreateTarget(target: string | null | undefined): string | null {
  if (!target?.startsWith(CREATE_TARGET_PREFIX)) return null
  return target.slice(CREATE_TARGET_PREFIX.length)
}

export function createTerminalTarget(sessionId: string): ExistingTerminalTarget {
  return `${TERMINAL_TARGET_PREFIX}${sessionId}`
}

export function createSpawnTarget(commandId: string): CreateTerminalTarget {
  return `${CREATE_TARGET_PREFIX}${commandId}`
}

function normalizeForegroundProcessTitle(raw: string | null | undefined): string | null {
  if (!raw) return null
  const value = raw.trim().toLowerCase()
  if (!value) return null
  return value.split(/[\\/]/).pop() ?? value
}

export function isLikelyShellForegroundProcess(raw: string | null | undefined): boolean {
  const normalized = normalizeForegroundProcessTitle(raw)
  if (!normalized) return false
  return SHELL_PROCESS_NAMES.has(normalized)
}

function stripAnsi(input: string): string {
  // CSI + OSC + 2-byte escapes.
  // eslint-disable-next-line no-control-regex -- ANSI CSI sequence uses ESC control code.
  const ansiCsiRegex = /\x1B\[[0-?]*[ -/]*[@-~]/g
  // eslint-disable-next-line no-control-regex -- ANSI OSC sequence uses ESC/BEL control codes.
  const ansiOscRegex = /\x1B\][^\u0007]*(\u0007|\x1B\\)/g
  // eslint-disable-next-line no-control-regex -- ANSI 2-byte escape sequence uses ESC control code.
  const ansiTwoByteRegex = /\x1B[@-Z\\-_]/g
  return input.replace(ansiCsiRegex, '').replace(ansiOscRegex, '').replace(ansiTwoByteRegex, '')
}

function stripUnsafeControlChars(input: string): string {
  let output = ''
  for (const char of input) {
    const code = char.charCodeAt(0)
    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d
    const isControl = (code >= 0x00 && code <= 0x1f) || code === 0x7f
    if (!isControl || isAllowedWhitespace) {
      output += char
    }
  }
  return output
}

export function sanitizeTerminalDispatchPayload(input: string): SanitizedTerminalPayload {
  const normalized = input.trim().replace(/\r\n?/g, '\n')
  const noAnsi = stripAnsi(normalized)
  const noUnsafeControls = stripUnsafeControlChars(noAnsi)
  return {
    text: noUnsafeControls,
    modified: noUnsafeControls !== input,
  }
}

export function buildTerminalSendPayload(text: string, shellMode: boolean): string {
  if (!shellMode) {
    return `${text}\n`
  }
  return `\x1b[200~${text}\x1b[201~\n`
}
