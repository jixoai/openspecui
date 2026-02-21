import type { AppRouter } from '@openspecui/server'
import { QueryClient } from '@tanstack/react-query'
import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
  type TRPCLink,
} from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import { getTrpcUrl, getWsUrl } from './api-config'
import { isStaticMode } from './static-mode'

// Check if running in browser
const isBrowser = typeof window !== 'undefined'

// Query client singleton for SPA
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
    },
  },
})

/** WebSocket 重连延迟（毫秒） */
export const WS_RETRY_DELAY_MS = 3000

// Lazy WebSocket client creation
let wsClient: ReturnType<typeof createWSClient> | null = null
function getWsClient() {
  if (!isBrowser || isStaticMode()) {
    return null
  }
  if (!wsClient) {
    try {
      wsClient = createWSClient({
        url: getWsUrl(),
        retryDelayMs: () => WS_RETRY_DELAY_MS,
        keepAlive: {
          enabled: true,
          intervalMs: 20000,
          pongTimeoutMs: 5000,
        },
        // Suppress connection errors in console
        onOpen: () => {
          // Connection opened successfully
        },
        onClose: (cause) => {
          // Only log if not in static mode (shouldn't happen, but just in case)
          if (!isStaticMode()) {
            console.log('WebSocket closed:', cause)
          }
        },
      })
    } catch (error) {
      // Suppress WebSocket creation errors in static mode
      if (!isStaticMode()) {
        console.error('Failed to create WebSocket client:', error)
      }
      return null
    }
  }
  return wsClient
}

// Export for cleanup if needed
export function getWsClientInstance() {
  return wsClient
}

// Ensure WS client exists and return it
export function getOrCreateWsClientInstance() {
  return getWsClient()
}

// Create tRPC client only in browser environment
function createTrpcClientSafe() {
  if (!isBrowser) {
    // Return a dummy client for SSR that throws on use
    return null as unknown as ReturnType<typeof createTRPCClient<AppRouter>>
  }

  return createTRPCClient<AppRouter>({
    links: [
      splitLink({
        // Use WebSocket for subscriptions (only if not in static mode)
        condition: (op) => op.type === 'subscription' && !isStaticMode(),
        true: ((runtime) => {
          const ws = getWsClient()
          if (ws) {
            return wsLink({ client: ws })(runtime)
          }
          return httpBatchLink({ url: getTrpcUrl() })(runtime)
        }) as TRPCLink<AppRouter>,
        // Use HTTP for queries and mutations
        false: httpBatchLink({
          url: getTrpcUrl(),
        }),
      }),
    ],
  })
}

// tRPC client singleton with WebSocket support for subscriptions
export const trpcClient = createTrpcClientSafe()

// tRPC options proxy for use with React Query hooks
// Use: trpc.router.procedure.queryOptions() with useQuery()
// Use: trpcClient.router.procedure.mutate() with useMutation()
export const trpc = isBrowser
  ? createTRPCOptionsProxy<AppRouter>({
      client: trpcClient,
      queryClient,
    })
  : (null as unknown as ReturnType<typeof createTRPCOptionsProxy<AppRouter>>)
