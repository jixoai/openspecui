export const CODE_EDITOR_THEME_VALUES = [
  'github',
  'material',
  'vscode',
  'tokyo',
  'gruvbox',
  'monokai',
  'nord',
] as const

export type CodeEditorTheme = (typeof CODE_EDITOR_THEME_VALUES)[number]

export const DEFAULT_CODE_EDITOR_THEME: CodeEditorTheme = 'github'

export const CODE_EDITOR_THEME_OPTIONS: Array<{ value: CodeEditorTheme; label: string }> = [
  { value: 'github', label: 'GitHub' },
  { value: 'material', label: 'Material' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'tokyo', label: 'Tokyo Night' },
  { value: 'gruvbox', label: 'Gruvbox' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'nord', label: 'Nord' },
]

export function isCodeEditorTheme(value: string): value is CodeEditorTheme {
  return (CODE_EDITOR_THEME_VALUES as readonly string[]).includes(value)
}
