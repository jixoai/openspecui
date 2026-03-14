const HOSTED_APP_CACHE_BROADCAST_CHANNEL = 'openspecui-app:cache-presence'
const CACHE_QUERY_TIMEOUT_MS = 350

type CachePresenceQueryMessage = {
  type: 'cache-presence-query'
  requestId: string
  senderId: string
}

type CachePresenceReportMessage = {
  cacheNames: string[]
  requestId: string
  senderId: string
  type: 'cache-presence-report'
}

type CachePresenceMessage = CachePresenceQueryMessage | CachePresenceReportMessage

interface BroadcastChannelLike {
  addEventListener(type: 'message', listener: EventListener): void
  close(): void
  postMessage(message: CachePresenceMessage): void
  removeEventListener(type: 'message', listener: EventListener): void
}

function createBroadcastChannel(name: string): BroadcastChannelLike | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null
  }

  const channel = new BroadcastChannel(name)
  return {
    addEventListener(type, listener) {
      channel.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      channel.removeEventListener(type, listener)
    },
    postMessage(message) {
      channel.postMessage(message)
    },
    close() {
      channel.close()
    },
  }
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cache-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function createHostedAppCacheBroadcast() {
  const channel = createBroadcastChannel(HOSTED_APP_CACHE_BROADCAST_CHANNEL)
  const instanceId = createRequestId()

  return {
    async collectPeerClaims(): Promise<Set<string>> {
      if (!channel) {
        return new Set()
      }

      const requestId = createRequestId()
      const claims = new Set<string>()

      await new Promise<void>((resolve) => {
        const onMessage: EventListener = (event) => {
          const payload = (event as MessageEvent<unknown>).data
          if (
            !payload ||
            typeof payload !== 'object' ||
            (payload as CachePresenceMessage).type !== 'cache-presence-report' ||
            (payload as CachePresenceReportMessage).requestId !== requestId ||
            (payload as CachePresenceReportMessage).senderId === instanceId
          ) {
            return
          }

          for (const cacheName of (payload as CachePresenceReportMessage).cacheNames) {
            claims.add(cacheName)
          }
        }

        channel.addEventListener('message', onMessage)
        channel.postMessage({
          type: 'cache-presence-query',
          requestId,
          senderId: instanceId,
        })

        window.setTimeout(() => {
          channel.removeEventListener('message', onMessage)
          resolve()
        }, CACHE_QUERY_TIMEOUT_MS)
      })

      return claims
    },
    startResponder(getCacheNames: () => readonly string[]) {
      if (!channel) {
        return () => {}
      }

      const onMessage: EventListener = (event) => {
        const payload = (event as MessageEvent<unknown>).data
        if (
          !payload ||
          typeof payload !== 'object' ||
          (payload as CachePresenceMessage).type !== 'cache-presence-query' ||
          (payload as CachePresenceQueryMessage).senderId === instanceId
        ) {
          return
        }

        channel.postMessage({
          type: 'cache-presence-report',
          requestId: (payload as CachePresenceQueryMessage).requestId,
          senderId: instanceId,
          cacheNames: Array.from(getCacheNames()),
        })
      }

      channel.addEventListener('message', onMessage)
      return () => {
        channel.removeEventListener('message', onMessage)
      }
    },
    stop() {
      channel?.close()
    },
  }
}
