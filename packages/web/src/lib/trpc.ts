import { QueryClient } from '@tanstack/react-query'
import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  splitLink,
  wsLink,
} from '@trpc/client'
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query'
import type { AppRouter } from '@openspecui/server'
import { getWsUrl, getTrpcUrl } from './api-config'

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

// Create WebSocket client for subscriptions
export const wsClient = createWSClient({
  url: getWsUrl(),
  retryDelayMs: () => WS_RETRY_DELAY_MS,
})

// tRPC client singleton with WebSocket support for subscriptions
export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      // Use WebSocket for subscriptions
      condition: (op) => op.type === 'subscription',
      true: wsLink({ client: wsClient }),
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
