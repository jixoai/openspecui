import type { HostPlatform } from './platform.js'

export type ModifierKey = 'ctrl' | 'alt' | 'meta' | 'shift' | 'caps'

export interface KeyDef {
  label: string
  data: string
  w?: number
  modifier?: ModifierKey
  special?: 'chord'
  shift?: { label: string; data: string }
}

const letter = (char: string): KeyDef => ({
  label: char,
  data: char,
  shift: { label: char.toUpperCase(), data: char.toUpperCase() },
})

const NAV_ROW: KeyDef[] = [
  { label: 'Esc', data: '\x1b', w: 1.1 },
  { label: 'Home', data: '\x1b[H', w: 1.2 },
  { label: 'End', data: '\x1b[F', w: 1.2 },
  { label: 'PgUp', data: '\x1b[5~', w: 1.2 },
  { label: 'PgDn', data: '\x1b[6~', w: 1.2 },
  { label: '⬅', data: '\x1b[D', w: 1 },
  { label: '⬆', data: '\x1b[A', w: 1 },
  { label: '⬇', data: '\x1b[B', w: 1 },
  { label: '⮕', data: '\x1b[C', w: 1 },
]

const NUMBER_KEYS: KeyDef[] = [
  { label: '`', data: '`', shift: { label: '~', data: '~' } },
  { label: '1', data: '1', shift: { label: '!', data: '!' } },
  { label: '2', data: '2', shift: { label: '@', data: '@' } },
  { label: '3', data: '3', shift: { label: '#', data: '#' } },
  { label: '4', data: '4', shift: { label: '$', data: '$' } },
  { label: '5', data: '5', shift: { label: '%', data: '%' } },
  { label: '6', data: '6', shift: { label: '^', data: '^' } },
  { label: '7', data: '7', shift: { label: '&', data: '&' } },
  { label: '8', data: '8', shift: { label: '*', data: '*' } },
  { label: '9', data: '9', shift: { label: '(', data: '(' } },
  { label: '0', data: '0', shift: { label: ')', data: ')' } },
  { label: '-', data: '-', shift: { label: '_', data: '_' } },
  { label: '=', data: '=', shift: { label: '+', data: '+' } },
]

const LETTERS_Q_ROW: KeyDef[] = 'qwertyuiop'.split('').map(letter)
const LETTERS_A_ROW: KeyDef[] = 'asdfghjkl'.split('').map(letter)
const LETTERS_Z_ROW: KeyDef[] = 'zxcvbnm'.split('').map(letter)

const Q_ROW: KeyDef[] = [
  { label: 'Tab', data: '\t', w: 1.5 },
  ...LETTERS_Q_ROW,
  {
    label: '[',
    data: '[',
    shift: { label: '{', data: '{' },
    w: 1,
  },
  {
    label: ']',
    data: ']',
    shift: { label: '}', data: '}' },
    w: 1,
  },
  { label: '\\', data: '\\', shift: { label: '|', data: '|' }, w: 1.3 },
]

const CAPS_ROW_COMMON: KeyDef[] = [
  { label: 'Caps', data: '', modifier: 'caps', w: 1.8 },
  ...LETTERS_A_ROW,
  { label: ';', data: ';', shift: { label: ':', data: ':' } },
  { label: "'", data: "'", shift: { label: '"', data: '"' } },
  { label: 'Enter', data: '\r', w: 2.1 },
]

const CAPS_ROW_MACOS: KeyDef[] = [
  { label: 'Caps', data: '', modifier: 'caps', w: 1.8 },
  ...LETTERS_A_ROW,
  { label: ';', data: ';', shift: { label: ':', data: ':' } },
  { label: "'", data: "'", shift: { label: '"', data: '"' } },
  { label: 'Return', data: '\r', w: 2.1 },
]

const SHIFT_ROW: KeyDef[] = [
  { label: 'Shift', data: '', modifier: 'shift', w: 2.2 },
  ...LETTERS_Z_ROW,
  { label: ',', data: ',', shift: { label: '<', data: '<' } },
  { label: '.', data: '.', shift: { label: '>', data: '>' } },
  { label: '/', data: '/', shift: { label: '?', data: '?' } },
  { label: 'Shift', data: '', modifier: 'shift', w: 2.2 },
]

const COMMON_BOTTOM_ROW: KeyDef[] = [
  { label: 'Ctrl', data: '', modifier: 'ctrl', w: 1.4 },
  { label: 'Alt', data: '', modifier: 'alt', w: 1.4 },
  { label: 'Meta', data: '', modifier: 'meta', w: 1.6 },
  { label: 'Space', data: ' ', w: 6.1 },
  { label: '⌬', data: '', special: 'chord', w: 1.9 },
]

const WINDOWS_BOTTOM_ROW: KeyDef[] = [
  { label: 'Ctrl', data: '', modifier: 'ctrl', w: 1.4 },
  { label: 'Win', data: '', modifier: 'meta', w: 1.6 },
  { label: 'Alt', data: '', modifier: 'alt', w: 1.4 },
  { label: 'Space', data: ' ', w: 6.1 },
  { label: '⌬', data: '', special: 'chord', w: 1.9 },
]

const MACOS_BOTTOM_ROW: KeyDef[] = [
  { label: 'Control', data: '', modifier: 'ctrl', w: 1.4 },
  { label: 'Option', data: '', modifier: 'alt', w: 1.5 },
  { label: 'Command', data: '', modifier: 'meta', w: 1.8 },
  { label: 'Space', data: ' ', w: 5.8 },
  { label: '⌬', data: '', special: 'chord', w: 1.9 },
]

const COMMON_ROWS: KeyDef[][] = [
  NAV_ROW,
  [...NUMBER_KEYS, { label: 'Bksp', data: '\x7f', w: 1.8 }],
  Q_ROW,
  CAPS_ROW_COMMON,
  SHIFT_ROW,
  COMMON_BOTTOM_ROW,
]

const WINDOWS_ROWS: KeyDef[][] = [
  NAV_ROW,
  [...NUMBER_KEYS, { label: 'Bksp', data: '\x7f', w: 1.8 }],
  Q_ROW,
  CAPS_ROW_COMMON,
  SHIFT_ROW,
  WINDOWS_BOTTOM_ROW,
]

const MACOS_ROWS: KeyDef[][] = [
  NAV_ROW,
  [...NUMBER_KEYS, { label: 'Delete', data: '\x7f', w: 1.8 }],
  Q_ROW,
  CAPS_ROW_MACOS,
  SHIFT_ROW,
  MACOS_BOTTOM_ROW,
]

export const LAYOUTS: Record<HostPlatform, KeyDef[][]> = {
  windows: WINDOWS_ROWS,
  macos: MACOS_ROWS,
  common: COMMON_ROWS,
}
