export function getRequestedFileUrl(): string {
  if (typeof window === 'undefined') return ''
  const params = new URLSearchParams(window.location.search)
  const file = params.get('file')
  if (!file) return ''
  return `./resource/${file}`
}

export function getRequestedTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark'
  const params = new URLSearchParams(window.location.search)
  const theme = params.get('theme')
  return theme === 'light' ? 'light' : 'dark'
}

interface PreviewThemeTokens {
  background: string
  foreground: string
  card: string
  primary: string
  primaryForeground: string
  muted: string
  mutedForeground: string
  border: string
  panelBorder: string
  fontMono: string
  fontNav: string
  radius: string
  shadowSm: string
  shadowMd: string
  shadowLg: string
}

function getPreviewThemeTokens(theme: 'light' | 'dark'): PreviewThemeTokens {
  if (theme === 'light') {
    return {
      background: 'oklch(1 0 0)',
      foreground: 'oklch(0 0 0)',
      card: 'oklch(1 0 0)',
      primary: 'oklch(0.6489 0.237 26.9728)',
      primaryForeground: 'oklch(1 0 0)',
      muted: 'oklch(0.9551 0 0)',
      mutedForeground: 'oklch(0.3211 0 0)',
      border: 'oklch(0 0 0)',
      panelBorder: 'transparent',
      fontMono:
        "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
      fontNav: "'Share Tech Mono', 'JetBrains Mono', SFMono-Regular, monospace",
      radius: '8px',
      shadowSm: '4px 4px 0px 0px hsl(0 0% 0% / 1), 4px 1px 2px -1px hsl(0 0% 100% / 1)',
      shadowMd: '4px 4px 0px 0px hsl(0 0% 0% / 1), 4px 2px 4px -1px hsl(0 0% 100% / 1)',
      shadowLg: '4px 4px 0px 0px hsl(0 0% 0% / 1), 4px 4px 6px -1px hsl(0 0% 100% / 1)',
    }
  }

  return {
    background: 'oklch(0 0 0)',
    foreground: 'oklch(1 0 0)',
    card: 'oklch(0.3211 0 0)',
    primary: 'oklch(0.7044 0.1872 23.1858)',
    primaryForeground: 'oklch(0 0 0)',
    muted: 'oklch(0.2178 0 0)',
    mutedForeground: 'oklch(0.8452 0 0)',
    border: 'oklch(1 0 0)',
    panelBorder: 'transparent',
    fontMono: "'JetBrains Mono', SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
    fontNav: "'Share Tech Mono', 'JetBrains Mono', SFMono-Regular, monospace",
    radius: '8px',
    shadowSm: '4px 4px 0px 0px hsl(0 0% 100% / 1), 4px 1px 2px -1px hsl(0 0% 0% / 1)',
    shadowMd: '4px 4px 0px 0px hsl(0 0% 100% / 1), 4px 2px 4px -1px hsl(0 0% 0% / 1)',
    shadowLg: '4px 4px 0px 0px hsl(0 0% 100% / 1), 4px 4px 6px -1px hsl(0 0% 0% / 1)',
  }
}

function ensurePreviewFonts(): void {
  if (typeof document === 'undefined') return
  if (document.head.querySelector('link[data-openspec-preview-fonts="stylesheet"]')) {
    return
  }

  const lang =
    (navigator.languages && navigator.languages[0]) ||
    navigator.language ||
    (navigator as typeof navigator & { userLanguage?: string }).userLanguage ||
    ''
  const useCnCdn = /^zh\b/i.test(lang)
  const apiHost = useCnCdn ? 'https://fonts.googleapis.cn' : 'https://fonts.googleapis.com'
  const staticHost = useCnCdn ? 'https://fonts.gstatic.cn' : 'https://fonts.gstatic.com'

  const preconnectApi = document.createElement('link')
  preconnectApi.rel = 'preconnect'
  preconnectApi.href = apiHost
  preconnectApi.dataset.openspecPreviewFonts = 'preconnect-api'

  const preconnectStatic = document.createElement('link')
  preconnectStatic.rel = 'preconnect'
  preconnectStatic.href = staticHost
  preconnectStatic.crossOrigin = 'anonymous'
  preconnectStatic.dataset.openspecPreviewFonts = 'preconnect-static'

  const stylesheet = document.createElement('link')
  stylesheet.rel = 'stylesheet'
  stylesheet.href = `${apiHost}/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Share+Tech+Mono&display=swap`
  stylesheet.dataset.openspecPreviewFonts = 'stylesheet'

  document.head.append(preconnectApi, preconnectStatic, stylesheet)
}

function applyPreviewThemeVariables(tokens: PreviewThemeTokens): void {
  const root = document.documentElement
  const set = (name: string, value: string) => {
    root.style.setProperty(name, value)
  }

  set('--background', tokens.background)
  set('--foreground', tokens.foreground)
  set('--card', tokens.card)
  set('--primary', tokens.primary)
  set('--primary-foreground', tokens.primaryForeground)
  set('--muted', tokens.muted)
  set('--muted-foreground', tokens.mutedForeground)
  set('--border', tokens.border)
  set('--panel-border', tokens.panelBorder)
  set('--font-mono', tokens.fontMono)
  set('--font-nav', tokens.fontNav)
  set('--radius', tokens.radius)

  set('--preview-background', tokens.background)
  set('--preview-foreground', tokens.foreground)
  set('--preview-card', tokens.card)
  set('--preview-primary', tokens.primary)
  set('--preview-primary-foreground', tokens.primaryForeground)
  set('--preview-muted', tokens.muted)
  set('--preview-muted-foreground', tokens.mutedForeground)
  set('--preview-border', tokens.border)
  set('--preview-panel-border', tokens.panelBorder)
  set('--preview-font-mono', tokens.fontMono)
  set('--preview-font-nav', tokens.fontNav)
  set('--preview-radius', '0px')
  set('--preview-radius-md', '0px')
  set('--preview-radius-lg', '0px')
  set('--preview-shadow-sm', tokens.shadowSm)
  set('--preview-shadow', tokens.shadowMd)
  set('--preview-shadow-lg', tokens.shadowLg)
  set('--preview-divider', 'color-mix(in oklab, var(--preview-border) 60%, transparent)')
  set(
    '--preview-toolbar-background',
    'color-mix(in oklab, var(--preview-muted) 20%, var(--preview-background))'
  )
  set(
    '--preview-panel',
    'color-mix(in oklab, var(--preview-muted) 28%, var(--preview-background))'
  )
  set(
    '--preview-panel-secondary',
    'color-mix(in oklab, var(--preview-muted) 14%, var(--preview-background))'
  )
  set(
    '--preview-interactive-surface',
    'color-mix(in oklab, var(--preview-muted) 64%, var(--preview-card))'
  )
  set(
    '--preview-button-disabled',
    'color-mix(in oklab, var(--preview-muted) 64%, var(--preview-background))'
  )
  set(
    '--preview-focus-ring',
    '0 0 0 3px color-mix(in oklab, var(--preview-primary) 34%, transparent)'
  )
  set(
    '--preview-shell-background',
    'linear-gradient(180deg, color-mix(in oklab, var(--preview-muted) 18%, var(--preview-background)) 0%, var(--preview-background) 100%)'
  )

  set('--yarl__container_background_color', 'var(--preview-card)')
  set('--yarl__color_button', 'var(--preview-foreground)')
  set('--yarl__color_button_active', 'var(--preview-primary)')
  set(
    '--yarl__color_button_disabled',
    'color-mix(in oklab, var(--preview-muted-foreground) 55%, transparent)'
  )
  set('--yarl__button_background_color', 'var(--preview-background)')
  set('--yarl__button_border', '1px solid var(--preview-border)')
  set('--yarl__button_filter', 'none')
  set('--yarl__button_padding', '10px')
  set('--yarl__button_margin', '0 0 0 8px')
  set('--yarl__toolbar_padding', '12px')
  set('--yarl__icon_size', '24px')
  set('--yarl__slide_border_radius', '0px')
  set('--yarl__toolbar_border_radius', '0px')

  set('--media-font-family', 'var(--preview-font-mono)')
  set('--media-focus-ring', 'var(--preview-focus-ring)')
  set('--media-button-border-radius', '0px')
  set('--media-button-touch-hover-border-radius', '0px')
  set('--media-button-hover-bg', 'var(--preview-interactive-surface)')
  set('--media-button-touch-hover-bg', 'var(--preview-interactive-surface)')
  set('--media-menu-border', '1px solid var(--preview-border)')
  set('--media-menu-bg', 'var(--preview-card)')
  set('--media-menu-box-shadow', 'var(--preview-shadow)')
  set('--media-menu-border-radius', '0px')
  set('--media-menu-item-border-radius', '0px')
  set('--media-menu-top-bar-bg', 'var(--preview-card)')
  set('--media-menu-divider', '1px solid var(--preview-divider)')
  set('--media-menu-item-color', 'var(--preview-foreground)')
  set('--media-menu-item-info-color', 'var(--preview-muted-foreground)')
  set('--media-menu-item-hover-bg', 'var(--preview-interactive-surface)')
  set('--media-menu-hint-color', 'var(--preview-muted-foreground)')
  set('--media-tooltip-bg-color', 'var(--preview-card)')
  set('--media-tooltip-border', '1px solid var(--preview-border)')
  set('--media-tooltip-border-radius', '0px')
  set('--media-tooltip-color', 'var(--preview-foreground)')
  set(
    '--media-slider-track-bg',
    'color-mix(in oklab, var(--preview-foreground) 24%, transparent)'
  )
  set(
    '--media-slider-track-progress-bg',
    'color-mix(in oklab, var(--preview-foreground) 36%, transparent)'
  )
  set('--media-slider-track-fill-bg', 'var(--preview-primary)')
  set('--media-slider-thumb-bg', 'var(--preview-background)')
  set('--media-slider-thumb-border', '1px solid var(--preview-border)')
  set(
    '--media-slider-focused-thumb-shadow',
    '0 0 0 4px color-mix(in oklab, var(--preview-primary) 28%, transparent)'
  )
  set('--media-slider-value-bg', 'var(--preview-card)')
  set('--media-slider-value-color', 'var(--preview-foreground)')
  set('--media-slider-value-border', '1px solid var(--preview-border)')
  set('--media-time-color', 'var(--preview-muted-foreground)')

  set('--audio-brand', 'var(--preview-primary)')
  set('--audio-bg', 'var(--preview-card)')
  set('--audio-border', '0 solid transparent')
  set('--audio-controls-color', 'var(--preview-foreground)')
  set(
    '--audio-title-color',
    'color-mix(in oklab, var(--preview-muted-foreground) 88%, var(--preview-foreground))'
  )
  set('--audio-play-button-bg', 'var(--preview-primary)')
  set('--audio-play-button-color', 'var(--preview-primary-foreground)')
  set('--audio-font-family', 'var(--preview-font-mono)')
  set('--audio-border-radius', '0px')
  set('--audio-slider-value-border', '1px solid var(--preview-border)')
  set(
    '--audio-slider-chapter-title-color',
    'color-mix(in oklab, var(--preview-foreground) 78%, var(--preview-background))'
  )

  set('--video-brand', 'var(--preview-primary)')
  set('--video-bg', 'var(--preview-card)')
  set('--video-border', '0 solid transparent')
  set('--video-controls-color', 'var(--preview-foreground)')
  set(
    '--video-title-color',
    'color-mix(in oklab, var(--preview-muted-foreground) 88%, var(--preview-foreground))'
  )
  set('--video-font-family', 'var(--preview-font-mono)')
  set('--video-border-radius', '0px')
  set('--video-time-bg', 'color-mix(in oklab, var(--preview-card) 82%, transparent)')
  set(
    '--video-scrim-bg',
    'color-mix(in oklab, var(--preview-background) 56%, transparent)'
  )

  const styleId = 'openspec-preview-media-overrides'
  let styleElement = document.getElementById(styleId)
  if (!(styleElement instanceof HTMLStyleElement)) {
    styleElement = document.createElement('style')
    styleElement.id = styleId
    document.head.append(styleElement)
  }
  styleElement.textContent = `
    media-menu > [data-media-menu-items],
    media-menu [role='menuitem'],
    media-menu [role='menuitemradio'],
    media-radio,
    media-tooltip,
    media-community-skin[data-audio] div[part~='media-ui'],
    media-community-skin[data-video] media-slider-thumbnail,
    media-community-skin[data-video] media-slider-value {
      border-radius: 0 !important;
    }

    media-menu [role='menuitem'][data-hocus],
    media-menu [role='menuitemradio'][data-hocus],
    media-menu media-radio[data-hocus],
    media-menu media-radio[data-hover],
    media-menu [role='menuitem']:hover,
    media-menu [role='menuitemradio']:hover {
      background: var(--preview-interactive-surface) !important;
      color: var(--preview-foreground) !important;
    }
  `
}

export function getPreviewRootElement(rootId = 'root'): HTMLElement {
  const root = document.getElementById(rootId)
  if (!(root instanceof HTMLElement)) {
    throw new Error(`Preview root element #${rootId} not found.`)
  }

  const fullHeightStyles = {
    height: '100%',
    minHeight: '100%',
    margin: '0',
  } satisfies Partial<CSSStyleDeclaration>

  Object.assign(document.documentElement.style, fullHeightStyles)
  ensurePreviewFonts()
  const theme = getRequestedTheme()
  const isDarkMode = theme === 'dark'
  const tokens = getPreviewThemeTokens(theme)
  document.documentElement.className = isDarkMode ? 'dark' : ''
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  applyPreviewThemeVariables(tokens)
  Object.assign(document.body.style, {
    ...fullHeightStyles,
    overflow: 'hidden',
    background: 'var(--preview-background)',
    color: 'var(--preview-foreground)',
    fontFamily: 'var(--preview-font-mono)',
  })
  Object.assign(root.style, {
    height: '100%',
    minHeight: '100%',
    margin: '0',
  })

  return root
}

export function createRootStyles(): React.CSSProperties {
  void getRequestedTheme()
  return {
    width: '100%',
    height: '100%',
    minHeight: '100%',
    margin: 0,
    background: 'var(--preview-background)',
    color: 'var(--preview-foreground)',
    fontFamily: 'var(--preview-font-mono)',
  }
}
