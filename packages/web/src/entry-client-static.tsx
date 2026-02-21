import { createRoot, hydrateRoot } from 'react-dom/client'
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

  if (hasPrerenderedContent()) {
    hydrateRoot(rootElement, <AppStatic />)
    return
  }

  createRoot(rootElement).render(<AppStatic />)
}

main()
