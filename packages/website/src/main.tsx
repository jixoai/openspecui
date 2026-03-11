import { createRoot } from 'react-dom/client'
import { App } from './app'
import './i18n'
import './index.css'
import { installWebsiteThemeSync } from './theme-bootstrap'

installWebsiteThemeSync()

const root = document.getElementById('app')
if (!root) {
  throw new Error('Missing #app root element')
}

createRoot(root).render(<App />)
