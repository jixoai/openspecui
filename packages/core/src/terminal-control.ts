import type {
  NotificationAction,
  NotificationPublishInput,
  NotificationSource,
} from './notifications.js'

const MAX_OSC_BUFFER_LENGTH = 8192

export type TerminalProgressState = 'clear' | 'set' | 'error' | 'indeterminate' | 'warning'
export type TerminalPromptState =
  | 'prompt-start'
  | 'prompt-end'
  | 'command-start'
  | 'command-output'
  | 'command-end'
export type TerminalNotificationProtocol = 'osc9' | 'osc777'
export type TerminalTitleTarget = 'icon' | 'window' | 'both'

export type TerminalControlEvent =
  | {
      type: 'bell'
    }
  | {
      type: 'notification'
      protocol: TerminalNotificationProtocol
      title?: string
      body: string
    }
  | {
      type: 'title'
      title: string
      target: TerminalTitleTarget
    }
  | {
      type: 'cwd'
      cwd: string
    }
  | {
      type: 'progress'
      state: TerminalProgressState
      value: number | null
    }
  | {
      type: 'prompt-state'
      state: TerminalPromptState
      exitCode?: number
    }

export interface TerminalControlParseResult {
  output: string
  events: TerminalControlEvent[]
}

function decodeOscText(input: string): string {
  return input.replace(/\r?\n/g, ' ').trim()
}

function parseProgressState(value: string): TerminalProgressState | null {
  if (value === '0') return 'clear'
  if (value === '1') return 'set'
  if (value === '2') return 'error'
  if (value === '3') return 'indeterminate'
  if (value === '4') return 'warning'
  return null
}

function parseProgressValue(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function parseFileUriPath(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'file:') return null
    return decodeURIComponent(url.pathname)
  } catch {
    return trimmed
  }
}

function parsePromptState(rest: string): TerminalControlEvent | null {
  const marker = rest[0]
  const suffix = rest.slice(1)
  if (marker === 'A') return { type: 'prompt-state', state: 'prompt-start' }
  if (marker === 'B') return { type: 'prompt-state', state: 'prompt-end' }
  if (marker === 'C') return { type: 'prompt-state', state: 'command-start' }
  if (marker === 'D') {
    const exitCodeText = suffix.startsWith(';') ? suffix.slice(1).split(';')[0] : ''
    const exitCode = exitCodeText ? Number(exitCodeText) : undefined
    return Number.isInteger(exitCode)
      ? { type: 'prompt-state', state: 'command-end', exitCode }
      : { type: 'prompt-state', state: 'command-end' }
  }
  return null
}

function parseVsCodeShellIntegration(rest: string): TerminalControlEvent | null {
  const marker = rest[0]
  const suffix = rest.slice(1)
  if (marker === 'A') return { type: 'prompt-state', state: 'prompt-start' }
  if (marker === 'B') return { type: 'prompt-state', state: 'prompt-end' }
  if (marker === 'C') return { type: 'prompt-state', state: 'command-start' }
  if (marker === 'D') {
    const exitCodeText = suffix.startsWith(';') ? suffix.slice(1).split(';')[0] : ''
    const exitCode = exitCodeText ? Number(exitCodeText) : undefined
    return Number.isInteger(exitCode)
      ? { type: 'prompt-state', state: 'command-end', exitCode }
      : { type: 'prompt-state', state: 'command-end' }
  }
  if (marker === 'P') {
    const cwdPrefix = ';Cwd='
    if (!suffix.startsWith(cwdPrefix)) return null
    const cwd = decodeOscText(suffix.slice(cwdPrefix.length))
    return cwd ? { type: 'cwd', cwd } : null
  }
  return null
}

function parseITerm2Control(rest: string): TerminalControlEvent | null {
  const currentDirPrefix = 'CurrentDir='
  if (!rest.startsWith(currentDirPrefix)) return null
  const cwd = decodeOscText(rest.slice(currentDirPrefix.length))
  return cwd ? { type: 'cwd', cwd } : null
}

function parseOscPayload(payload: string): TerminalControlEvent | null {
  const firstSeparator = payload.indexOf(';')
  const command = firstSeparator === -1 ? payload : payload.slice(0, firstSeparator)
  const rest = firstSeparator === -1 ? '' : payload.slice(firstSeparator + 1)

  if (command === '0' || command === '1' || command === '2') {
    const title = decodeOscText(rest)
    if (!title) return null
    return {
      type: 'title',
      title,
      target: command === '1' ? 'icon' : command === '2' ? 'window' : 'both',
    }
  }

  if (command === '7') {
    const cwd = parseFileUriPath(rest)
    return cwd ? { type: 'cwd', cwd } : null
  }

  if (command === '9') {
    const progressPrefix = '4;'
    if (rest.startsWith(progressPrefix)) {
      const parts = rest.slice(progressPrefix.length).split(';')
      const state = parseProgressState(parts[0] ?? '')
      if (!state) return null
      return {
        type: 'progress',
        state,
        value: parseProgressValue(parts[1]),
      }
    }

    const cwdPrefix = '9;'
    if (rest.startsWith(cwdPrefix)) {
      const cwd = decodeOscText(rest.slice(cwdPrefix.length))
      return cwd ? { type: 'cwd', cwd } : null
    }

    const body = decodeOscText(rest)
    return body ? { type: 'notification', protocol: 'osc9', body } : null
  }

  if (command === '133') return parsePromptState(rest)
  if (command === '633') return parseVsCodeShellIntegration(rest)
  if (command === '1337') return parseITerm2Control(rest)

  if (command !== '777') return null

  const parts = rest.split(';')
  if (parts[0]?.trim().toLowerCase() !== 'notify') return null
  const title = decodeOscText(parts[1] ?? '')
  const body = decodeOscText(parts.slice(2).join(';'))
  return {
    type: 'notification',
    protocol: 'osc777',
    title: title || 'Terminal notification',
    body,
  }
}

/**
 * Stateful parser for terminal control escape sequences.
 *
 * It extracts terminal-local control metadata separately from notification
 * intents so progress, title, cwd, and prompt-state protocols cannot leak into
 * the web notification platform.
 */
export class TerminalControlParser {
  private pending = ''

  push(chunk: string): TerminalControlParseResult {
    const input = this.pending + chunk
    this.pending = ''

    let output = ''
    const events: TerminalControlEvent[] = []
    let index = 0

    while (index < input.length) {
      const char = input[index]

      if (char === '\x07') {
        events.push({ type: 'bell' })
        index += 1
        continue
      }

      if (char !== '\x1b' || input[index + 1] !== ']') {
        output += char
        index += 1
        continue
      }

      const sequenceStart = index
      const payloadStart = index + 2
      const belEnd = input.indexOf('\x07', payloadStart)
      const stEnd = input.indexOf('\x1b\\', payloadStart)
      const end = belEnd === -1 ? stEnd : stEnd === -1 ? belEnd : Math.min(belEnd, stEnd)

      if (end === -1) {
        const pending = input.slice(sequenceStart)
        if (pending.length <= MAX_OSC_BUFFER_LENGTH) {
          this.pending = pending
        } else {
          output += pending
        }
        break
      }

      const payload = input.slice(payloadStart, end)
      const event = parseOscPayload(payload)
      if (event) {
        events.push(event)
      } else {
        output += input.slice(sequenceStart, end + (end === stEnd ? 2 : 1))
      }

      index = end + (end === stEnd ? 2 : 1)
    }

    return { output, events }
  }
}

export function terminalNotificationEventToPublishInput(input: {
  event: Extract<TerminalControlEvent, { type: 'notification' }>
  sessionId: string
  terminalTitle?: string
}): NotificationPublishInput {
  const fallbackTitle = input.terminalTitle?.trim() || input.sessionId
  const source: NotificationSource = {
    type: 'terminal',
    sessionId: input.sessionId,
    title: fallbackTitle,
  }
  const actions: NotificationAction[] = [
    {
      type: 'terminal.focus',
      label: 'Focus terminal',
      target: {
        sessionId: input.sessionId,
      },
    },
  ]

  return {
    title: input.event.title ?? fallbackTitle,
    body: input.event.body,
    source,
    actions,
    level: 'info',
  }
}
