import {
  DEFAULT_TERMINAL_DARK_THEME,
  DEFAULT_TERMINAL_LIGHT_THEME,
  DEFAULT_TERMINAL_THEME_MODE,
  TERMINAL_THEME_MODE_VALUES,
  TERMINAL_THEME_VALUES,
  type TerminalThemeId,
  type TerminalThemeMode,
} from '@openspecui/core/terminal-theme'

export {
  DEFAULT_TERMINAL_DARK_THEME,
  DEFAULT_TERMINAL_LIGHT_THEME,
  DEFAULT_TERMINAL_THEME_MODE,
  TERMINAL_THEME_MODE_VALUES,
  TERMINAL_THEME_VALUES,
  type TerminalThemeId,
  type TerminalThemeMode,
}

export interface TerminalPalette {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

export interface TerminalThemeDefinition {
  id: TerminalThemeId
  label: string
  modeHint: 'light' | 'dark' | 'either'
  palette: TerminalPalette
}

export interface ResolvedTerminalTheme {
  id: TerminalThemeId
  mode: 'light' | 'dark'
  definition: TerminalThemeDefinition
}

export const TERMINAL_THEME_OPTIONS: Array<{ value: TerminalThemeId; label: string }> = [
  { value: 'default-light', label: 'Default Light' },
  { value: 'default-dark', label: 'Default Dark' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'nord', label: 'Nord' },
  { value: 'solarized-light', label: 'Solarized Light' },
  { value: 'solarized-dark', label: 'Solarized Dark' },
]

const TERMINAL_THEME_REGISTRY: Record<TerminalThemeId, TerminalThemeDefinition> = {
  'default-light': {
    id: 'default-light',
    label: 'Default Light',
    modeHint: 'light',
    palette: {
      background: '#f6f5f2',
      foreground: '#1b1b1b',
      cursor: '#ea580c',
      cursorAccent: '#f6f5f2',
      selectionBackground: 'rgba(234, 88, 12, 0.22)',
      black: '#111111',
      red: '#b91c1c',
      green: '#15803d',
      yellow: '#a16207',
      blue: '#1d4ed8',
      magenta: '#a21caf',
      cyan: '#0f766e',
      white: '#f6f5f2',
      brightBlack: '#4b5563',
      brightRed: '#dc2626',
      brightGreen: '#16a34a',
      brightYellow: '#ca8a04',
      brightBlue: '#2563eb',
      brightMagenta: '#c026d3',
      brightCyan: '#0891b2',
      brightWhite: '#ffffff',
    },
  },
  'default-dark': {
    id: 'default-dark',
    label: 'Default Dark',
    modeHint: 'dark',
    palette: {
      background: '#141414',
      foreground: '#e5dfd2',
      cursor: '#f97316',
      cursorAccent: '#141414',
      selectionBackground: 'rgba(249, 115, 22, 0.28)',
      black: '#151515',
      red: '#f87171',
      green: '#4ade80',
      yellow: '#facc15',
      blue: '#60a5fa',
      magenta: '#e879f9',
      cyan: '#67e8f9',
      white: '#f4f1ea',
      brightBlack: '#6b7280',
      brightRed: '#fca5a5',
      brightGreen: '#86efac',
      brightYellow: '#fde047',
      brightBlue: '#93c5fd',
      brightMagenta: '#f0abfc',
      brightCyan: '#a5f3fc',
      brightWhite: '#fffdf8',
    },
  },
  monokai: {
    id: 'monokai',
    label: 'Monokai',
    modeHint: 'either',
    palette: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      cursorAccent: '#272822',
      selectionBackground: 'rgba(73, 72, 62, 0.9)',
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#f4bf75',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#f4bf75',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5',
    },
  },
  nord: {
    id: 'nord',
    label: 'Nord',
    modeHint: 'either',
    palette: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: 'rgba(94, 129, 172, 0.38)',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#d08770',
      brightGreen: '#8fbcbb',
      brightYellow: '#eceff4',
      brightBlue: '#5e81ac',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
  },
  'solarized-light': {
    id: 'solarized-light',
    label: 'Solarized Light',
    modeHint: 'light',
    palette: {
      background: '#fdf6e3',
      foreground: '#586e75',
      cursor: '#cb4b16',
      cursorAccent: '#fdf6e3',
      selectionBackground: 'rgba(147, 161, 161, 0.32)',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#657b83',
      brightRed: '#cb4b16',
      brightGreen: '#93a1a1',
      brightYellow: '#839496',
      brightBlue: '#6c71c4',
      brightMagenta: '#d33682',
      brightCyan: '#2aa198',
      brightWhite: '#fdf6e3',
    },
  },
  'solarized-dark': {
    id: 'solarized-dark',
    label: 'Solarized Dark',
    modeHint: 'dark',
    palette: {
      background: '#002b36',
      foreground: '#93a1a1',
      cursor: '#cb4b16',
      cursorAccent: '#002b36',
      selectionBackground: 'rgba(88, 110, 117, 0.5)',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#657b83',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
  },
}

export function isTerminalThemeMode(value: string): value is TerminalThemeMode {
  return (TERMINAL_THEME_MODE_VALUES as readonly string[]).includes(value)
}

export function isTerminalThemeId(value: string): value is TerminalThemeId {
  return (TERMINAL_THEME_VALUES as readonly string[]).includes(value)
}

export function resolveTerminalThemeMode(input: {
  useTheme?: TerminalThemeMode
  appDarkMode: boolean
  systemDarkMode: boolean
}): 'light' | 'dark' {
  const mode = input.useTheme ?? DEFAULT_TERMINAL_THEME_MODE
  if (mode === 'light') return 'light'
  if (mode === 'dark') return 'dark'
  if (mode === 'system') return input.systemDarkMode ? 'dark' : 'light'
  return input.appDarkMode ? 'dark' : 'light'
}

export function resolveTerminalTheme(input: {
  useTheme?: TerminalThemeMode
  lightTheme?: TerminalThemeId
  darkTheme?: TerminalThemeId
  appDarkMode: boolean
  systemDarkMode: boolean
}): ResolvedTerminalTheme {
  const mode = resolveTerminalThemeMode(input)
  const id =
    mode === 'dark'
      ? (input.darkTheme ?? DEFAULT_TERMINAL_DARK_THEME)
      : (input.lightTheme ?? DEFAULT_TERMINAL_LIGHT_THEME)

  return {
    id,
    mode,
    definition: TERMINAL_THEME_REGISTRY[id],
  }
}

export function getTerminalThemeDefinition(id: TerminalThemeId): TerminalThemeDefinition {
  return TERMINAL_THEME_REGISTRY[id]
}
