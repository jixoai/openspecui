/**
 * Orthogonal intents (created 2026-07-26 Asia/Shanghai):
 * 1. Subscribe to lifecycle-only Root and Store Projection Work notices.
 * 2. Resolve only the connected locator's in-memory credential on every handshake.
 * 3. Decode notices at the browser trust boundary without carrying business projection data.
 *
 * Original request (2026-07-26): "Push 通知变更，然后让多端基于订阅拉取更新。"
 */
import {
  HostedCliProjectionNoticeSchema,
  type HostedCliProjectionNotice,
} from '@openspecui/core/hosted-contract'
import type { AppRouter } from '@openspecui/server'
import { createTRPCClient, createWSClient, wsLink } from '@trpc/client'
import { readLaunchCredential } from './launch-credential'

export type CliProjectionSelector =
  | { kind: 'root-context' }
  | { kind: 'store-list' }
  | { kind: 'store-doctor'; storeId?: string }

export interface CliProjectionTransportCallbacks {
  onNotice(notice: HostedCliProjectionNotice): void
  onConnectionState(state: 'connecting' | 'pending'): void
  onError(error: unknown): void
  onStopped(): void
  onComplete(): void
}

export interface CliProjectionTransport {
  unsubscribe(): void
}

export interface CliProjectionTransportFactory {
  connect(
    apiBaseUrl: string,
    selector: CliProjectionSelector,
    callbacks: CliProjectionTransportCallbacks
  ): CliProjectionTransport
}

interface TRPCCliProjectionTransportOptions {
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

/** Create the real locator-scoped lifecycle-only Projection Work transport. */
export function createTRPCCliProjectionTransportFactory(
  options: TRPCCliProjectionTransportOptions = {}
): CliProjectionTransportFactory {
  return {
    connect(apiBaseUrl, selector, callbacks) {
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
      const observer = {
        onData(raw: unknown) {
          const decoded = HostedCliProjectionNoticeSchema.safeParse(raw)
          if (!decoded.success) {
            callbacks.onError(
              new Error(`Malformed CLI projection notice: ${decoded.error.message}`)
            )
            return
          }
          callbacks.onNotice(decoded.data)
        },
        onError: callbacks.onError,
        onConnectionStateChange(connection: { state: string; error?: unknown }) {
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
      }
      const subscription =
        selector.kind === 'root-context'
          ? client.rootContext.subscribeProjection.subscribe(undefined, observer)
          : client.stores.subscribeProjection.subscribe(
              selector.kind === 'store-list'
                ? { kind: 'list' }
                : { kind: 'doctor', id: selector.storeId },
              observer
            )
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
