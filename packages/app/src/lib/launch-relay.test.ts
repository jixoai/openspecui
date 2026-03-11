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
      ...createNoHeartbeatRuntime(),
    })

    const stop = relay.start(() => {})

    expect(relay.isLeader()).toBe(true)
    expect(readHostedLaunchLeader(storage)?.windowId).toBe('window-a')

    stop()
  })

  it('forwards a launch to the current leader and receives an ack', async () => {
    vi.useFakeTimers()
    const storage = createMemoryStorage()
    const pair = createChannelPair()
    const launches: string[] = []

    const leader = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.primary,
      windowId: 'leader-window',
      ...createNoHeartbeatRuntime(),
    })
    const follower = createHostedLaunchRelay({
      storage,
      createChannel: () => pair.secondary,
      windowId: 'follower-window',
      ...createNoHeartbeatRuntime(),
    })

    const stopLeader = leader.start((request) => {
      launches.push(request.apiBaseUrl)
    })
    const stopFollower = follower.start(() => {})

    const resultPromise = follower.dispatch({ apiBaseUrl: 'http://localhost:3100' })
    await vi.advanceTimersByTimeAsync(450)

    expect(await resultPromise).toBe('forwarded')
    expect(launches).toEqual(['http://localhost:3100'])

    stopFollower()
    stopLeader()
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
      now: () => currentTime,
      ...createNoHeartbeatRuntime(),
    })
    const stop = relay.start((request) => {
      launches.push(request.apiBaseUrl)
    })

    storage.setItem(
      'openspecui-app:pwa-leader',
      JSON.stringify({ windowId: 'missing-window', updatedAt: currentTime })
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
