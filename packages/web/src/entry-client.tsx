/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Select live/static hydration and render the Project Web root.
 * 2. Consume and strip a launch credential before importing App-owned navigation or transports.
 * 3. Activate the transient native-resource header bridge for guarded sessions.
 *
 * Original request (2026-07-24): "Project Web consumes and removes it before rendering."
 * Defect correction (2026-07-26): root-route normalization must not retire the private launch
 * fragment before the in-memory Access Gate owner consumes it.
 */
import { createRoot, hydrateRoot } from 'react-dom/client'
import {
  activateAccessGateResourceWorker,
  consumeAccessGateLaunchCredential,
} from './lib/access-gate-credential'
import { getHostedApiState } from './lib/api-config'
import { detectStaticMode, setStaticMode } from './lib/static-mode'

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

async function main() {
  const rootElement = document.getElementById('root')!
  const launchCredential = consumeAccessGateLaunchCredential()
  if (launchCredential) {
    if (!('serviceWorker' in navigator)) {
      const { HostedConnectionState } = await import('./components/hosted-connection-state')
      createRoot(rootElement).render(
        <HostedConnectionState
          title="Protected Session Unavailable"
          message="This browser cannot install the transient protected-resource transport."
        />
      )
      return
    }
    try {
      await activateAccessGateResourceWorker(navigator.serviceWorker)
    } catch (error) {
      const { HostedConnectionState } = await import('./components/hosted-connection-state')
      createRoot(rootElement).render(
        <HostedConnectionState
          title="Protected Session Unavailable"
          message={error instanceof Error ? error.message : String(error)}
        />
      )
      return
    }
  }
  const hostedApiState = getHostedApiState()
  if (hostedApiState.hosted && !hostedApiState.apiBaseUrl) {
    const { HostedConnectionState } = await import('./components/hosted-connection-state')
    createRoot(rootElement).render(<HostedConnectionState />)
    return
  }

  const isStatic = isSSGMode() || (await detectStaticMode())
  setStaticMode(isStatic)

  if (isStatic) {
    console.log('[OpenSpec UI] Running in static mode')
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
