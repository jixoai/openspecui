import { createRoot } from 'react-dom/client'
import { App } from './App'
import { detectStaticMode, setStaticMode } from './lib/static-mode'

// Detect static mode before rendering
detectStaticMode().then((isStatic) => {
  setStaticMode(isStatic)
  if (isStatic) {
    console.log('Running in static export mode')
  }
  createRoot(document.getElementById('root')!).render(<App />)
})
