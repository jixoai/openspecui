import type { HostPlatform } from './platform.js'

export type ShortcutCommand = 'copy' | 'paste' | 'select-all'

export type ShortcutAction =
  | { type: 'send'; data: string }
  | { type: 'text'; text: string }
  | { type: 'command'; command: ShortcutCommand }

export interface ShortcutItem {
  id: string
  label: string
  subLabel?: string
  col: number
  row: number
  cols?: number
  rows?: number
  kind?: 'button' | 'dpad'
  action?: ShortcutAction
}

export interface ShortcutPage {
  id: string
  title: string
  hint: string
  cols: number
  rows: number
  items: ShortcutItem[]
}

const GRID_COLS = 14
const GRID_ROWS = 5

const ROW_TOP = 0
const ROW_Q = 1
const ROW_A = 2
const ROW_Z = 3
const ROW_BOTTOM = 4

function modKey(platform: HostPlatform): 'Cmd' | 'Ctrl' {
  return platform === 'macos' ? 'Cmd' : 'Ctrl'
}

function codexPasteImageLabel(platform: HostPlatform): string {
  if (platform === 'common') {
    return 'Ctrl+V / Ctrl+Alt+V'
  }
  return 'Ctrl+V'
}

function systemPage(platform: HostPlatform): ShortcutPage {
  const mod = modKey(platform)
  return {
    id: 'system',
    title: 'System',
    hint: 'OS clipboard and editor helpers.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    items: [
      {
        id: 'select-all',
        label: 'Select All',
        subLabel: `${mod}+A`,
        col: 2,
        row: ROW_A,
        cols: 2,
        action: { type: 'command', command: 'select-all' },
      },
      {
        id: 'copy',
        label: 'Copy',
        subLabel: `${mod}+C`,
        col: 5,
        row: ROW_Z,
        cols: 2,
        action: { type: 'command', command: 'copy' },
      },
      {
        id: 'paste',
        label: 'Paste',
        subLabel: `${mod}+V`,
        col: 7,
        row: ROW_Z,
        cols: 2,
        action: { type: 'command', command: 'paste' },
      },
    ],
  }
}

function terminalPage(): ShortcutPage {
  return {
    id: 'terminal',
    title: 'Terminal',
    hint: 'Shell navigation and line-editing combos.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    items: [
      {
        id: 'ctrl-w',
        label: 'Kill Word',
        subLabel: 'Ctrl+W',
        col: 3,
        row: ROW_Q,
        cols: 2,
        action: { type: 'send', data: '\x17' },
      },
      {
        id: 'ctrl-r',
        label: 'History Search',
        subLabel: 'Ctrl+R',
        col: 5,
        row: ROW_Q,
        cols: 2,
        action: { type: 'send', data: '\x12' },
      },
      {
        id: 'ctrl-u',
        label: 'Kill Left',
        subLabel: 'Ctrl+U',
        col: 8,
        row: ROW_Q,
        cols: 2,
        action: { type: 'send', data: '\x15' },
      },

      {
        id: 'ctrl-a',
        label: 'Line Start',
        subLabel: 'Ctrl+A',
        col: 2,
        row: ROW_A,
        cols: 2,
        action: { type: 'send', data: '\x01' },
      },
      {
        id: 'ctrl-d',
        label: 'EOF',
        subLabel: 'Ctrl+D',
        col: 4,
        row: ROW_A,
        cols: 2,
        action: { type: 'send', data: '\x04' },
      },
      {
        id: 'ctrl-f',
        label: 'Char Right',
        subLabel: 'Ctrl+F',
        col: 6,
        row: ROW_A,
        cols: 2,
        action: { type: 'send', data: '\x06' },
      },
      {
        id: 'ctrl-k',
        label: 'Kill Right',
        subLabel: 'Ctrl+K',
        col: 9,
        row: ROW_A,
        cols: 2,
        action: { type: 'send', data: '\x0b' },
      },
      {
        id: 'ctrl-l',
        label: 'Clear',
        subLabel: 'Ctrl+L',
        col: 11,
        row: ROW_A,
        cols: 2,
        action: { type: 'send', data: '\x0c' },
      },

      {
        id: 'ctrl-z',
        label: 'Suspend',
        subLabel: 'Ctrl+Z',
        col: 3,
        row: ROW_Z,
        cols: 2,
        action: { type: 'send', data: '\x1a' },
      },
      {
        id: 'ctrl-c',
        label: 'Interrupt',
        subLabel: 'Ctrl+C',
        col: 5,
        row: ROW_Z,
        cols: 2,
        action: { type: 'send', data: '\x03' },
      },
      {
        id: 'ctrl-v',
        label: 'Literal',
        subLabel: 'Ctrl+V',
        col: 7,
        row: ROW_Z,
        cols: 2,
        action: { type: 'send', data: '\x16' },
      },
      {
        id: 'ctrl-y',
        label: 'Yank',
        subLabel: 'Ctrl+Y',
        col: 9,
        row: ROW_Z,
        cols: 2,
        action: { type: 'send', data: '\x19' },
      },

      {
        id: 'alt-b',
        label: 'Prev Word',
        subLabel: 'Alt+B',
        col: 6,
        row: ROW_BOTTOM,
        cols: 2,
        action: { type: 'send', data: '\x1bb' },
      },
      {
        id: 'alt-f',
        label: 'Next Word',
        subLabel: 'Alt+F',
        col: 8,
        row: ROW_BOTTOM,
        cols: 2,
        action: { type: 'send', data: '\x1bf' },
      },
    ],
  }
}

function claudePage(): ShortcutPage {
  return {
    id: 'claude',
    title: 'Claude',
    hint: 'Claude Code interactive controls.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    items: [
      {
        id: 'claude-commands',
        label: '/ Commands',
        subLabel: '/',
        col: 1,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '/' },
      },
      {
        id: 'claude-shell',
        label: '! Shell',
        subLabel: '!',
        col: 3,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '!' },
      },
      {
        id: 'claude-files',
        label: '@ Paths',
        subLabel: '@',
        col: 5,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '@' },
      },
      {
        id: 'claude-newline',
        label: 'Newline',
        subLabel: '\\ + Enter',
        col: 8,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'text', text: '\\\n' },
      },
      {
        id: 'claude-edit-last',
        label: 'Edit Previous',
        subLabel: 'Esc Esc',
        col: 11,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'send', data: '\x1b\x1b' },
      },

      {
        id: 'claude-editor',
        label: 'External Editor',
        subLabel: 'Ctrl+G',
        col: 2,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x07' },
      },
      {
        id: 'claude-reverse-search',
        label: 'History Search',
        subLabel: 'Ctrl+R',
        col: 5,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x12' },
      },
      {
        id: 'claude-bg',
        label: 'Background Task',
        subLabel: 'Ctrl+B',
        col: 8,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x02' },
      },
      {
        id: 'claude-task-list',
        label: 'Task List',
        subLabel: 'Ctrl+T',
        col: 11,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x14' },
      },

      {
        id: 'claude-change-mode',
        label: 'Change Mode',
        subLabel: 'Shift+Tab',
        col: 1,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x1b[Z' },
      },
      {
        id: 'claude-cancel',
        label: 'Cancel',
        subLabel: 'Ctrl+C',
        col: 4,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x03' },
      },
      {
        id: 'claude-exit',
        label: 'Exit',
        subLabel: 'Ctrl+D',
        col: 7,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x04' },
      },
    ],
  }
}

function codexPage(platform: HostPlatform): ShortcutPage {
  return {
    id: 'codex',
    title: 'Codex',
    hint: 'Codex CLI shortcuts.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    items: [
      {
        id: 'codex-commands',
        label: '/ Commands',
        subLabel: '/',
        col: 1,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '/' },
      },
      {
        id: 'codex-shell',
        label: '! Shell',
        subLabel: '!',
        col: 3,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '!' },
      },
      {
        id: 'codex-files',
        label: '@ Paths',
        subLabel: '@',
        col: 5,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '@' },
      },
      {
        id: 'codex-newline',
        label: 'Newline',
        subLabel: 'Shift+Enter',
        col: 8,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'send', data: '\n' },
      },
      {
        id: 'codex-queue',
        label: 'Queue Message',
        subLabel: 'Tab',
        col: 11,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'send', data: '\t' },
      },

      {
        id: 'codex-editor',
        label: 'External Editor',
        subLabel: 'Ctrl+G',
        col: 4,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x07' },
      },
      {
        id: 'codex-edit-last',
        label: 'Edit Previous',
        subLabel: 'Esc Esc',
        col: 7,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x1b\x1b' },
      },
      {
        id: 'codex-transcript',
        label: 'Transcript',
        subLabel: 'Ctrl+T',
        col: 10,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x14' },
      },

      {
        id: 'codex-paste-image',
        label: 'Paste Image',
        subLabel: codexPasteImageLabel(platform),
        col: 6,
        row: ROW_Z,
        cols: 3,
        action: { type: 'send', data: '\x16' },
      },

      {
        id: 'codex-change-mode',
        label: 'Change Mode',
        subLabel: 'Shift+Tab',
        col: 1,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x1b[Z' },
      },
      {
        id: 'codex-exit',
        label: 'Exit',
        subLabel: 'Ctrl+C',
        col: 4,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x03' },
      },
    ],
  }
}

function geminiPage(): ShortcutPage {
  return {
    id: 'gemini',
    title: 'Gemini',
    hint: 'Gemini CLI keyboard shortcuts.',
    cols: GRID_COLS,
    rows: GRID_ROWS,
    items: [
      {
        id: 'gemini-shell-mode',
        label: 'Shell Mode',
        subLabel: '!',
        col: 1,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '!' },
      },
      {
        id: 'gemini-shortcuts-panel',
        label: 'Shortcuts',
        subLabel: '?',
        col: 3,
        row: ROW_TOP,
        cols: 2,
        action: { type: 'text', text: '?' },
      },
      {
        id: 'gemini-editor',
        label: 'External Editor',
        subLabel: 'Ctrl+X',
        col: 5,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'send', data: '\x18' },
      },
      {
        id: 'gemini-reverse-search',
        label: 'Reverse Search',
        subLabel: 'Ctrl+R',
        col: 8,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'send', data: '\x12' },
      },
      {
        id: 'gemini-edit-last',
        label: 'Edit Previous',
        subLabel: 'Esc Esc',
        col: 11,
        row: ROW_TOP,
        cols: 3,
        action: { type: 'send', data: '\x1b\x1b' },
      },

      {
        id: 'gemini-ide-context',
        label: 'IDE Context',
        subLabel: 'Ctrl+G',
        col: 4,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x07' },
      },
      {
        id: 'gemini-todo-list',
        label: 'TODO List',
        subLabel: 'Ctrl+T',
        col: 7,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x14' },
      },
      {
        id: 'gemini-change-mode',
        label: 'Change Mode',
        subLabel: 'Shift+Tab',
        col: 10,
        row: ROW_A,
        cols: 3,
        action: { type: 'send', data: '\x1b[Z' },
      },

      {
        id: 'gemini-cancel',
        label: 'Cancel',
        subLabel: 'Ctrl+C',
        col: 4,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x03' },
      },
      {
        id: 'gemini-exit',
        label: 'Exit Empty',
        subLabel: 'Ctrl+D',
        col: 7,
        row: ROW_BOTTOM,
        cols: 3,
        action: { type: 'send', data: '\x04' },
      },
    ],
  }
}

export function buildShortcutPages(platform: HostPlatform): ShortcutPage[] {
  return [systemPage(platform), terminalPage(), claudePage(), codexPage(platform), geminiPage()]
}
