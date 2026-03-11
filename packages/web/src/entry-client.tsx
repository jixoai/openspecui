import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { HostedConnectionState } from './components/hosted-connection-state'
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
