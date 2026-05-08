/**
 * Browser-safe terminal theme constants.
 *
 * Keep this module free of Node/runtime-specific imports so web packages can
 * consume the same terminal theme law via a dedicated subpath export.
 */
export const TERMINAL_THEME_MODE_VALUES = ['app', 'light', 'dark', 'system'] as const
export type TerminalThemeMode = (typeof TERMINAL_THEME_MODE_VALUES)[number]

export const TERMINAL_THEME_VALUES = [
  'default-light',
  'default-dark',
  'monokai',
  'nord',
  'solarized-light',
  'solarized-dark',
] as const
export type TerminalThemeId = (typeof TERMINAL_THEME_VALUES)[number]

export const DEFAULT_TERMINAL_THEME_MODE: TerminalThemeMode = 'app'
export const DEFAULT_TERMINAL_LIGHT_THEME: TerminalThemeId = 'default-light'
export const DEFAULT_TERMINAL_DARK_THEME: TerminalThemeId = 'default-dark'
