/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Select live/static hydration and render the Project Web root.
 * 2. Consume and strip a launch credential before any UI render.
 * 3. Activate the transient native-resource header bridge for guarded sessions.
 *
 * Original request (2026-07-24): "Project Web consumes and removes it before rendering."
 */
import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { HostedConnectionState } from './components/hosted-connection-state'
import { getHostedApiState } from './lib/api-config'
import {
  activateAccessGateResourceWorker,
  consumeAccessGateLaunchCredential,
} from './lib/access-gate-credential'
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
    createRoot(rootElement).render(<HostedConnectionState />)
    return
  }

  const isStatic = isSSGMode() || (await detectStaticMode())
  setStaticMode(isStatic)

  if (isStatic) {
    console.log('[OpenSpec UI] Running in static mode')
  }

  if (hasPrerenderedContent() && isStatic) {
    console.log('[OpenSpec UI] Hydrating pre-rendered content')
    hydrateRoot(rootElement, <App />)
  } else {
    console.log('[OpenSpec UI] Fresh render')
    createRoot(rootElement).render(<App />)
  }
}

main()
