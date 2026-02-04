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
  if (isStaticMode()) {
    return null
  }
  if (!wsClient) {
    try {
      wsClient = createWSClient({
        url: getWsUrl(),
        retryDelayMs: () => WS_RETRY_DELAY_MS,
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

// tRPC client singleton with WebSocket support for subscriptions
export const trpcClient = createTRPCClient<AppRouter>({
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

// tRPC options proxy for use with React Query hooks
// Use: trpc.router.procedure.queryOptions() with useQuery()
// Use: trpcClient.router.procedure.mutate() with useMutation()
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
})
