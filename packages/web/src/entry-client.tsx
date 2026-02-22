/**
 * Client-side entry point with hydration support
 *
 * This file handles both:
 * 1. Fresh render (SPA mode) - when no pre-rendered HTML exists
 * 2. Hydration (SSG mode) - when HTML was pre-rendered on server
 */
import { createRoot, hydrateRoot } from 'react-dom/client'
import { App } from './App'
import { detectStaticMode, setStaticMode } from './lib/static-mode'

// Check if we have pre-rendered content (SSG mode)
const hasPrerenderedContent = () => {
  const root = document.getElementById('root')
  // If root has children, it was pre-rendered
  return root && root.innerHTML.trim().length > 0
}

// Check if we're in static mode via window flag (set by SSG)
const isSSGMode = () => {
  return (
    !import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.__OPENSPEC_STATIC_MODE__ === true
  )
}

async function main() {
  const rootElement = document.getElementById('root')!

  // Detect static mode
  const isStatic = isSSGMode() || (await detectStaticMode())
  setStaticMode(isStatic)

  if (isStatic) {
    console.log('[OpenSpec UI] Running in static mode')
  }

  // Choose render method based on whether we have pre-rendered content
  if (hasPrerenderedContent() && isStatic) {
    // Hydration mode - attach event listeners to existing HTML
    console.log('[OpenSpec UI] Hydrating pre-rendered content')
    hydrateRoot(rootElement, <App />)
  } else {
    // Fresh render mode - render from scratch
    console.log('[OpenSpec UI] Fresh render')
    createRoot(rootElement).render(<App />)
  }
}

main()
