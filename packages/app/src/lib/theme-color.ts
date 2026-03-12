const HOSTED_SHELL_THEME_COLOR = '#121212'

export function getHostedShellThemeColor(): string {
  return HOSTED_SHELL_THEME_COLOR
}

export function applyHostedShellThemeColor(doc: Document = document): void {
  for (const element of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    element.setAttribute('content', HOSTED_SHELL_THEME_COLOR)
  }
}
