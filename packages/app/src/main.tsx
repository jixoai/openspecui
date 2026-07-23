/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Bootstrap the App router from a sanitized hosted launch URL.
 * 2. Bind launch credentials before locator removal without persisting them.
 * 3. Register the hosted service worker and mount the React application.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Delivery correction (2026-07-24): the launch locator owns its fragment credential.
 */
import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { createAppRouter, type AppRouterContext } from './app-router'
import './index.css'
import { consumeHostedLaunchUrl, registerHostedServiceWorker } from './lib/bootstrap'
import { normalizeHostedApiBaseUrl } from './lib/shell-state'

const root = document.getElementById('app')
if (!root) {
  throw new Error('Missing #app root element')
}

const launch = consumeHostedLaunchUrl(window.location.href, (url) => {
  window.history.replaceState({}, '', url)
})

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
