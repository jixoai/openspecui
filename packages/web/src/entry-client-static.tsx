import { createRoot } from 'react-dom/client'
import { AppStatic } from './App.static'
import { setStaticMode } from './lib/static-mode'

function hasPrerenderedContent() {
  const root = document.getElementById('root')
  return !!root && root.innerHTML.trim().length > 0
}

function main() {
  const rootElement = document.getElementById('root')
  if (!rootElement) return

  setStaticMode(true)
  // Use client render in static mode to avoid hydration-time store mismatch
  // when third-party stores don't provide server snapshots.
  if (hasPrerenderedContent()) {
    rootElement.innerHTML = ''
  }
  createRoot(rootElement).render(<AppStatic />)
}

main()
