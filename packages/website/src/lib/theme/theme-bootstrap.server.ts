const themeBootstrapSource = String.raw`
(() => {
  const storageKey = 'theme'
  const root = document.documentElement
  const isTheme = (value) => value === 'light' || value === 'dark' || value === 'system'
  const getStoredTheme = () => {
    try {
      const stored = window.localStorage.getItem(storageKey)
      return isTheme(stored) ? stored : 'system'
    } catch {
      return 'system'
    }
  }
  const theme = getStoredTheme()
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark))
  root.style.colorScheme = root.classList.contains('dark') ? 'dark' : 'light'
})()
`.trim()

export const websiteThemeBootstrapScript = `<script>${themeBootstrapSource}</script>`
