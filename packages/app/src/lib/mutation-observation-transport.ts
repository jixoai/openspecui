/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Subscribe to the typed Server mutation-ledger procedure through the installed tRPC protocol.
 * 2. Resolve only the connected locator's current runtime-memory credential on every handshake.
 * 3. Translate tRPC transport lifecycle callbacks without decoding lifecycle payloads here.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import type { AppRouter } from '@openspecui/server'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import { readLaunchCredential } from './launch-credential'
import type {
  MutationLifecycleTransport,
  MutationObservationTransportFactory,
} from './mutation-observation'

interface TRPCMutationObservationTransportOptions {
  WebSocket?: typeof globalThis.WebSocket
  retryDelayMs?: (attemptIndex: number) => number
}

function toTRPCWebSocketUrl(apiBaseUrl: string): string {
  const url = new URL(apiBaseUrl)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/trpc`
  url.search = ''
  url.hash = ''
  return url.toString()
}

/** Create the App's real locator-scoped mutation-ledger transport factory. */
export function createTRPCMutationObservationTransportFactory(
  options: TRPCMutationObservationTransportOptions = {}
): MutationObservationTransportFactory {
  return {
    connect(apiBaseUrl, callbacks): MutationLifecycleTransport {
      const wsClient = createWSClient({
        url: toTRPCWebSocketUrl(apiBaseUrl),
        connectionParams: () => {
          const credential = readLaunchCredential(apiBaseUrl)
          return credential ? { authorization: `Bearer ${credential}` } : {}
        },
        ...(options.WebSocket ? { WebSocket: options.WebSocket } : {}),
        ...(options.retryDelayMs ? { retryDelayMs: options.retryDelayMs } : {}),
      })
      const client = createTRPCClient<AppRouter>({ links: [wsLink({ client: wsClient })] })
      const subscription = client.stores.subscribeMutations.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
        onConnectionStateChange(connection) {
          if (connection.error) {
            callbacks.onError(connection.error)
            return
          }
          if (connection.state === 'connecting' || connection.state === 'pending') {
            callbacks.onConnectionState(connection.state)
          }
        },
        onStopped: callbacks.onStopped,
        onComplete: callbacks.onComplete,
      })
      let retired = false
      return {
        unsubscribe() {
          if (retired) return
          retired = true
          subscription.unsubscribe()
          void wsClient.close()
        },
      }
    },
  }
}
