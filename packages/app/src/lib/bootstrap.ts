import { normalizeHostedApiBaseUrl, type HostedShellLaunchRequest } from './shell-state'

export interface HostedLaunchParseResult {
  request: HostedShellLaunchRequest | null
  error: string | null
  hasLaunchParams: boolean
}

export interface HostedServiceWorkerRegistration {
  update(): Promise<unknown>
}

export interface HostedServiceWorkerRuntime {
  register(
    scriptUrl: string,
    options: { scope: string; type?: 'module' }
  ): Promise<HostedServiceWorkerRegistration>
}

export interface HostedBootstrapRuntime {
  dev: boolean
  location: Pick<Location, 'search' | 'href'>
  serviceWorker?: HostedServiceWorkerRuntime
}

export function parseHostedLaunchParams(search: string): HostedLaunchParseResult {
  const params = new URLSearchParams(search)
  const rawVersion = params.get('version')?.trim() ?? ''
  const rawApi = params.get('api')?.trim() ?? ''
  const hasLaunchParams = rawApi.length > 0 || rawVersion.length > 0

  if (!hasLaunchParams) {
    return {
      request: null,
      error: null,
      hasLaunchParams: false,
    }
  }

  if (!rawApi) {
    return {
      request: null,
      error: 'Hosted launch URLs require ?api.',
      hasLaunchParams: true,
    }
  }

  const apiBaseUrl = normalizeHostedApiBaseUrl(rawApi)
  if (!apiBaseUrl) {
    return {
      request: null,
      error: `Invalid hosted backend URL: ${rawApi}`,
      hasLaunchParams: true,
    }
  }

  return {
    request: {
      apiBaseUrl,
    },
    error: null,
    hasLaunchParams: true,
  }
}

export function stripHostedLaunchParams(href: string): string {
  const url = new URL(href)
  url.searchParams.delete('version')
  url.searchParams.delete('api')
  return `${url.pathname}${url.search}${url.hash}`
}

function createBrowserRuntime(): HostedBootstrapRuntime {
  return {
    dev: import.meta.env.DEV,
    location: window.location,
    serviceWorker: typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined,
  }
}

export async function registerHostedServiceWorker(
  runtime: HostedBootstrapRuntime = createBrowserRuntime()
): Promise<void> {
  if (runtime.dev || !runtime.serviceWorker) {
    return
  }

  const registration = await runtime.serviceWorker.register('/service-worker.js', {
    scope: '/',
  })
  await registration.update()
}
