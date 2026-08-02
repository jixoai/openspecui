/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Select live/static hydration and render the Project Web root.
 * 2. Consume and strip a launch credential before importing App-owned navigation or transports.
 * 3. Activate the transient native-resource header bridge for guarded sessions.
 * 4. Resolve live Project Web admission before any App transport owner can initialize.
 *
 * Original request (2026-07-24): "Project Web consumes and removes it before rendering."
 * Defect correction (2026-07-26): root-route normalization must not retire the private launch
 * fragment before the in-memory Access Gate owner consumes it.
 */
import { createRoot, hydrateRoot } from 'react-dom/client'
import {
  accessGateFetch,
  activateAccessGateResourceWorker,
  consumeAccessGateLaunchCredential,
} from './lib/access-gate-credential'
import { getHealthUrl, getHostedApiState } from './lib/api-config'
import { getHostedThemeOverride } from './lib/hosted-session'
import { detectStaticMode, setStaticMode } from './lib/static-mode'
import { applyTheme, persistTheme } from './lib/theme'

const hasPrerenderedContent = () => {
  const root = document.getElementById('root')
  return root && root.innerHTML.trim().length > 0
}

const isSSGMode = () => {
  return (
    !import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.__OPENSPEC_STATIC_MODE__ === true
  )
}

interface HostedConnectionPresentation {
  title: string
  message: string
  onRetry?: () => void
}

async function renderHostedConnectionState(
  rootElement: HTMLElement,
  presentation: HostedConnectionPresentation
): Promise<void> {
  const { HostedConnectionState } = await import('./components/hosted-connection-state')
  createRoot(rootElement).render(<HostedConnectionState {...presentation} />)
}

async function admitLiveProjectWeb(): Promise<HostedConnectionPresentation | null> {
  try {
    const response = await accessGateFetch(getHealthUrl())
    if (response.ok) return null
    if (response.status === 401 || response.status === 403) {
      return {
        title: 'Authentication Required',
        message: 'This Project Web session does not have a valid backend credential.',
      }
    }
    return {
      title: 'Project Web Unavailable',
      message: `Backend admission failed with ${response.status} ${response.statusText || 'Unknown Error'}.`,
      onRetry: () => window.location.reload(),
    }
  } catch (error) {
    return {
      title: 'Project Web Unavailable',
      message: error instanceof Error ? error.message : String(error),
      onRetry: () => window.location.reload(),
    }
  }
}

async function main() {
  const rootElement = document.getElementById('root')!
  const launchCredential = consumeAccessGateLaunchCredential()
  if (launchCredential) {
    if (!('serviceWorker' in navigator)) {
      await renderHostedConnectionState(rootElement, {
        title: 'Protected Session Unavailable',
        message: 'This browser cannot install the transient protected-resource transport.',
      })
      return
    }
    try {
      await activateAccessGateResourceWorker(navigator.serviceWorker)
    } catch (error) {
      await renderHostedConnectionState(rootElement, {
        title: 'Protected Session Unavailable',
        message: error instanceof Error ? error.message : String(error),
      })
      return
    }
  }
  const hostedApiState = getHostedApiState()
  if (hostedApiState.hosted && !hostedApiState.apiBaseUrl) {
    await renderHostedConnectionState(rootElement, {
      title: 'Hosted Session Not Connected',
      message: 'This embedded UI session needs explicit api and session query parameters.',
    })
    return
  }

  // App-forced theme override (URL param): apply before React renders to avoid FOUC.
  const hostedThemeOverride = getHostedThemeOverride(window.location)
  if (hostedThemeOverride) {
    applyTheme(hostedThemeOverride)
    persistTheme(hostedThemeOverride)
  }

  const isStatic = isSSGMode() || (await detectStaticMode())
  setStaticMode(isStatic)

  if (isStatic) {
    console.log('[OpenSpec UI] Running in static mode')
  } else {
    const admissionFailure = await admitLiveProjectWeb()
    if (admissionFailure) {
      await renderHostedConnectionState(rootElement, admissionFailure)
      return
    }
  }

  // App imports the navigation and transport singletons, so it must remain behind credential bootstrap.
  const { App } = await import('./App')
  if (hasPrerenderedContent() && isStatic) {
    console.log('[OpenSpec UI] Hydrating pre-rendered content')
    hydrateRoot(rootElement, <App />)
  } else {
    console.log('[OpenSpec UI] Fresh render')
    createRoot(rootElement).render(<App />)
  }
}

void main()
