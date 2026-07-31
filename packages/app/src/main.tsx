/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Bootstrap the App router from a sanitized hosted launch URL.
 * 2. Bind launch credentials before locator removal without persisting them.
 * 3. Retain the native host presentation across client-side route navigation.
 * 4. Mount the React application after launch ownership is established.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Delivery correction (2026-07-24): the launch locator owns its fragment credential.
 * Owner correction (2026-07-30): the self-drawn titlebar must not disappear when native bridge observation is late.
 * Owner correction (2026-07-31): PWA and service-worker bootstrapping are retired.
 */
import { RouterProvider } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { createAppRouter, type AppRouterContext } from './app-router'
import './index.css'
import { consumeHostedLaunchUrl, parseHostedAppPresentation } from './lib/bootstrap'
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

const routerContext: AppRouterContext = {
  initialLaunchRequest: launch.request,
  fallbackLaunchRequest,
  initialError: launch.error,
  appPresentation: parseHostedAppPresentation(window.location.search),
}

const router = createAppRouter(routerContext)

createRoot(root).render(<RouterProvider router={router} />)
