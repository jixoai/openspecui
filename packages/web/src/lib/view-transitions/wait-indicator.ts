const WAIT_INDICATOR_STYLE_ID = 'vt-ready-indicator-style'
const WAIT_INDICATOR_ATTR = 'data-vt-ready-indicator'

function ensureWaitIndicatorStyle(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(WAIT_INDICATOR_STYLE_ID)) return

  const style = document.createElement('style')
  style.id = WAIT_INDICATOR_STYLE_ID
  style.textContent = `
    [${WAIT_INDICATOR_ATTR}] {
      position: fixed;
      inset: 0 0 auto 0;
      height: 3px;
      pointer-events: none;
      z-index: 2147483647;
      view-transition-name: none;
      background: color-mix(in srgb, var(--primary, #ff6b3d) 18%, transparent);
      overflow: hidden;
    }

    [${WAIT_INDICATOR_ATTR}] > span {
      display: block;
      width: 38%;
      height: 100%;
      background: var(--primary, #ff6b3d);
      box-shadow: 0 0 12px color-mix(in srgb, var(--primary, #ff6b3d) 60%, transparent);
      animation: vt-ready-indicator-slide 1.05s cubic-bezier(0.22, 1, 0.36, 1) infinite;
      transform-origin: left center;
    }

    @keyframes vt-ready-indicator-slide {
      0% {
        transform: translateX(-120%) scaleX(0.5);
      }
      55% {
        transform: translateX(180%) scaleX(1);
      }
      100% {
        transform: translateX(320%) scaleX(0.55);
      }
    }
  `
  document.head.append(style)
}

export function createViewTransitionWaitIndicatorController() {
  let indicator: HTMLDivElement | null = null
  let showTimer: number | null = null

  const hide = () => {
    if (showTimer !== null) {
      window.clearTimeout(showTimer)
      showTimer = null
    }
    indicator?.remove()
    indicator = null
  }

  const show = () => {
    if (typeof document === 'undefined' || indicator) return
    ensureWaitIndicatorStyle()
    const root = document.createElement('div')
    root.setAttribute(WAIT_INDICATOR_ATTR, '')
    root.setAttribute('aria-hidden', 'true')
    const bar = document.createElement('span')
    root.append(bar)
    document.body.append(root)
    indicator = root
  }

  return {
    schedule(delayMs: number) {
      if (typeof window === 'undefined' || showTimer !== null) return
      showTimer = window.setTimeout(() => {
        showTimer = null
        show()
      }, delayMs)
    },
    hide,
  }
}
