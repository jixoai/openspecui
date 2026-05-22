import { Agent, EnvHttpProxyAgent, setGlobalDispatcher, type Dispatcher } from 'undici'

const DEFAULT_CONNECT_TIMEOUT_MS = 30_000

let sharedDispatcher: Dispatcher | null = null

export function createProxyAwareDispatcher(): Dispatcher {
  if (hasProxyEnvironment()) {
    return new EnvHttpProxyAgent({
      httpProxy: process.env.http_proxy ?? process.env.HTTP_PROXY,
      httpsProxy: process.env.https_proxy ?? process.env.HTTPS_PROXY,
      noProxy: process.env.no_proxy ?? process.env.NO_PROXY,
      connectTimeout: DEFAULT_CONNECT_TIMEOUT_MS,
    })
  }

  return new Agent({
    connectTimeout: DEFAULT_CONNECT_TIMEOUT_MS,
  })
}

export function ensureProxyAwareFetchDispatcher(): Dispatcher {
  if (sharedDispatcher) return sharedDispatcher
  sharedDispatcher = createProxyAwareDispatcher()
  setGlobalDispatcher(sharedDispatcher)
  return sharedDispatcher
}

function hasProxyEnvironment(): boolean {
  return Boolean(
    process.env.http_proxy ||
      process.env.HTTP_PROXY ||
      process.env.https_proxy ||
      process.env.HTTPS_PROXY ||
      process.env.all_proxy ||
      process.env.ALL_PROXY
  )
}
