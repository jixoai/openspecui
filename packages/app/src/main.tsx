import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { createAppRouter, type AppRouterContext } from './app-router'
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

const routerContext: AppRouterContext = {
  initialLaunchRequest: launch.request,
  fallbackLaunchRequest,
  initialError: launch.error,
}

const router = createAppRouter(routerContext)

createRoot(root).render(<RouterProvider router={router} />)
