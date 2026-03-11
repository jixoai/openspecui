import { createRoot } from 'react-dom/client'
import { HostedShell } from './components/hosted-shell'
import './index.css'
import {
  parseHostedLaunchParams,
  registerHostedServiceWorker,
  stripHostedLaunchParams,
} from './lib/bootstrap'
import { normalizeHostedApiBaseUrl } from './lib/shell-state'

const root = document.getElementById('app')
if (!root) {
  throw new Error('Missing #app root element')
}

const launch = parseHostedLaunchParams(window.location.search)
if (launch.hasLaunchParams) {
  window.history.replaceState({}, '', stripHostedLaunchParams(window.location.href))
}

const fallbackApiBaseUrl = normalizeHostedApiBaseUrl(
  import.meta.env.VITE_OPENSPECUI_APP_DEFAULT_API_URL ?? ''
)
const fallbackLaunchRequest = fallbackApiBaseUrl
  ? {
      apiBaseUrl: fallbackApiBaseUrl,
    }
  : null

void registerHostedServiceWorker().catch((error: unknown) => {
  console.warn('Failed to register hosted app service worker:', error)
})

createRoot(root).render(
  <HostedShell
    initialLaunchRequest={launch.request}
    fallbackLaunchRequest={fallbackLaunchRequest}
    initialError={launch.error}
  />
)
