/**
 * Orthogonal intents (updated 2026-07-26 Asia/Shanghai):
 * 1. Prove PWA/browser launch leadership and relay settlement.
 * 2. Prove forwarded credentials bind only in runtime memory for the matching locator.
 * 3. Prove every live window converges on the complete locator credential set without persistence.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Delivery correction (2026-07-24): relay credentials transiently without persisted shell state.
 */
import { describe, expect, it, vi } from 'vitest'
import { createHostedLaunchRelay, readHostedLaunchLeader } from './launch-relay'

function createMemoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear() {
      map.clear()
    },
    getItem(key: string) {
      return map.get(key) ?? null
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null
    },
    removeItem(key: string) {
      map.delete(key)
    },
    setItem(key: string, value: string) {
      map.set(key, value)
    },
  }
}

function createChannelPair() {
  const listeners = new Set<EventListener>()
  const listenersPeer = new Set<EventListener>()

  const makeChannel = (current: Set<EventListener>, peer: Set<EventListener>) => ({
    postMessage(message: unknown) {
      const event = new MessageEvent('message', { data: message })
      for (const listener of peer) {
        listener(event)
      }
    },
    addEventListener(_type: 'message', listener: EventListener) {
      current.add(listener)
    },
    removeEventListener(_type: 'message', listener: EventListener) {
      current.delete(listener)
    },
    close() {
      current.clear()
    },
  })

  return {
    primary: makeChannel(listeners, listenersPeer),
    secondary: makeChannel(listenersPeer, listeners),
  }
}

function createChannelHub() {
  const listenersByChannel = new Map<string, Set<EventListener>>()

  return {
    create(channelId: string) {
      const listeners = new Set<EventListener>()
      listenersByChannel.set(channelId, listeners)
      return {
        postMessage(message: unknown) {
          globalThis.setTimeout(() => {
            const event = new MessageEvent('message', { data: message })
            for (const [peerId, peerListeners] of listenersByChannel) {
              if (peerId === channelId) continue
              for (const listener of peerListeners) listener(event)
            }
          }, 0)
        },
        addEventListener(_type: 'message', listener: EventListener) {
          listeners.add(listener)
        },
        removeEventListener(_type: 'message', listener: EventListener) {
          listeners.delete(listener)
        },
        close() {
          listenersByChannel.delete(channelId)
        },
      }
    },
  }
}

function createNoHeartbeatRuntime() {
  return {
    setInterval: () => 0,
    clearInterval: () => {},
    focusWindow: () => {},
  }
}

describe('hosted launch relay', () => {
  it('claims leadership when no leader exists', () => {
    const storage = createMemoryStorage()
    const relay = createHostedLaunchRelay({
      storage,
      createChannel: () => null,
      windowId: 'window-a',
      role: 'browser',
      ...createNoHeartbeatRuntime(),
    })

    const stop = relay.start(() => {})

    expect(relay.isLeader()).toBe(true)
    expect(readHostedLaunchLeader(storage)).toEqual({
      windowId: 'window-a',
      updatedAt: expect.any(Number),
      role: 'browser',
    })

    stop()
  })

  it('lets a pwa window take leadership from a browser window', () => {
    const storage = createMemoryStorage()
    const pair = createChannelPair()

    const browserRelay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.primary,
      windowId: 'browser-window',
      role: 'browser',
      ...createNoHeartbeatRuntime(),
    })
    const pwaRelay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.secondary,
      windowId: 'pwa-window',
      role: 'pwa',
      ...createNoHeartbeatRuntime(),
    })

    const stopBrowser = browserRelay.start(() => {})
    const stopPwa = pwaRelay.start(() => {})

    expect(readHostedLaunchLeader(storage)?.windowId).toBe('pwa-window')
    expect(readHostedLaunchLeader(storage)?.role).toBe('pwa')
    expect(browserRelay.isLeader()).toBe(false)
    expect(pwaRelay.isLeader()).toBe(true)

    stopPwa()
    stopBrowser()
  })

  it('forwards launches to the pwa leader and reports the forwarded-to-pwa result', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorage()
    const pair = createChannelPair()
    const launches: string[] = []

    const pwaRelay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.primary,
      windowId: 'pwa-window',
      role: 'pwa',
      ...createNoHeartbeatRuntime(),
    })
    const browserRelay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.secondary,
      windowId: 'browser-window',
      role: 'browser',
      ...createNoHeartbeatRuntime(),
    })

    const stopPwa = pwaRelay.start((request) => {
      launches.push(request.apiBaseUrl)
    })
    const stopBrowser = browserRelay.start(() => {})

    const resultPromise = browserRelay.dispatch({ apiBaseUrl: 'http://localhost:3100' })
    await vi.advanceTimersByTimeAsync(450)

    expect(await resultPromise).toBe('forwarded-to-pwa')
    expect(launches).toEqual(['http://localhost:3100'])

    stopBrowser()
    stopPwa()
    vi.useRealTimers()
  })

  it('binds a forwarded credential to the same locator in the PWA runtime only', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorage()
    const pair = createChannelPair()
    const pwaCredentials = new Map<string, string>()

    const pwaRelay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.primary,
      windowId: 'pwa-window',
      role: 'pwa',
      bindCredential(apiBaseUrl, credential) {
        pwaCredentials.set(apiBaseUrl, credential)
        return true
      },
      ...createNoHeartbeatRuntime(),
    })
    const browserRelay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.secondary,
      windowId: 'browser-window',
      role: 'browser',
      readCredential(apiBaseUrl) {
        return apiBaseUrl === 'http://localhost:3100' ? 'credential-a' : null
      },
      ...createNoHeartbeatRuntime(),
    })

    const stopPwa = pwaRelay.start(() => {})
    const stopBrowser = browserRelay.start(() => {})
    const resultPromise = browserRelay.dispatch({ apiBaseUrl: 'http://localhost:3100' })
    await vi.advanceTimersByTimeAsync(450)

    expect(await resultPromise).toBe('forwarded-to-pwa')
    expect(pwaCredentials).toEqual(new Map([['http://localhost:3100', 'credential-a']]))
    expect(storage.getItem('openspecui-app:pwa-leader')).not.toContain('credential-a')

    stopBrowser()
    stopPwa()
    vi.useRealTimers()
  })

  it('converges three live windows on every locator credential without persisting secrets', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorage()
    const hub = createChannelHub()
    const credentials = {
      a: new Map([['http://localhost:3101', 'credential-a']]),
      b: new Map([['http://localhost:3102', 'credential-b']]),
      c: new Map([['http://localhost:3103', 'credential-c']]),
    }

    const createRelay = (windowId: keyof typeof credentials) =>
      createHostedLaunchRelay({
        storage,
        createChannel: () => hub.create(windowId),
        windowId,
        role: 'browser',
        readCredential: (apiBaseUrl) => credentials[windowId].get(apiBaseUrl) ?? null,
        readCredentialSnapshot: () =>
          Array.from(credentials[windowId], ([apiBaseUrl, credential]) => ({
            apiBaseUrl,
            credential,
          })),
        bindCredential(apiBaseUrl, credential) {
          credentials[windowId].set(apiBaseUrl, credential)
          return true
        },
        ...createNoHeartbeatRuntime(),
      })

    const relayA = createRelay('a')
    const relayB = createRelay('b')
    const relayC = createRelay('c')
    const stopA = relayA.start(() => {})
    const stopB = relayB.start(() => {})
    const stopC = relayC.start(() => {})

    const launchB = relayB.dispatch({ apiBaseUrl: 'http://localhost:3102' })
    await vi.advanceTimersByTimeAsync(1)
    expect(await launchB).toBe('forwarded')

    const launchC = relayC.dispatch({ apiBaseUrl: 'http://localhost:3103' })
    await vi.advanceTimersByTimeAsync(1)
    expect(await launchC).toBe('forwarded')

    const expected = new Map([
      ['http://localhost:3101', 'credential-a'],
      ['http://localhost:3102', 'credential-b'],
      ['http://localhost:3103', 'credential-c'],
    ])
    expect(credentials.a).toEqual(expected)
    expect(credentials.b).toEqual(expected)
    expect(credentials.c).toEqual(expected)
    expect(Array.from({ length: storage.length }, (_, index) => storage.key(index))).toEqual([
      'openspecui-app:pwa-leader',
    ])
    expect(storage.getItem('openspecui-app:pwa-leader')).not.toContain('credential-')

    stopC()
    stopB()
    stopA()
    vi.useRealTimers()
  })

  it('falls back to local apply when the recorded leader expires before ack', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorage()
    const pair = createChannelPair()
    const launches: string[] = []
    let currentTime = 10_000

    const relay = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.primary,
      windowId: 'window-a',
      role: 'browser',
      now: () => currentTime,
      ...createNoHeartbeatRuntime(),
    })
    const stop = relay.start((request) => {
      launches.push(request.apiBaseUrl)
    })

    storage.setItem(
      'openspecui-app:pwa-leader',
      JSON.stringify({ windowId: 'missing-window', updatedAt: currentTime, role: 'browser' })
    )

    const resultPromise = relay.dispatch({ apiBaseUrl: 'http://localhost:3200' })
    currentTime += 7_000
    await vi.advanceTimersByTimeAsync(450)

    expect(await resultPromise).toBe('fallback-applied')
    expect(launches).toEqual(['http://localhost:3200'])

    stop()
    vi.useRealTimers()
  })
})
