import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { createAppRouter, type AppRouterContext } from './app-router'
import './index.css'
import {
  parseHostedLaunchParams,
  registerHostedServiceWorker,
  stripHostedLaunchParams,
} from './lib/bootstrap'
import { consumeLaunchCredential } from './lib/launch-credential'
import { normalizeHostedApiBaseUrl } from './lib/shell-state'

const root = document.getElementById('app')
if (!root) {
  throw new Error('Missing #app root element')
}

const launch = parseHostedLaunchParams(window.location.search)
if (launch.hasLaunchParams) {
  window.history.replaceState({}, '', stripHostedLaunchParams(window.location.href))
}

// Consume an auto-launched Access Gate credential from the URL fragment once, into session memory,
// then strip the fragment so it never persists in history or visible state.
consumeLaunchCredential({})

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

const routerContext: AppRouterContext = {
  initialLaunchRequest: launch.request,
  fallbackLaunchRequest,
  initialError: launch.error,
}

const router = createAppRouter(routerContext)

createRoot(root).render(<RouterProvider router={router} />)
