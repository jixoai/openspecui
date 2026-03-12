import { describe, expect, it } from 'vitest'
import { createHostedShellSync } from './hosted-shell-sync'
import { getHostedShellStorageKey, type HostedShellState } from './shell-state'

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
  const peerListeners = new Set<EventListener>()

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
    primary: makeChannel(listeners, peerListeners),
    secondary: makeChannel(peerListeners, listeners),
  }
}

function createState(apiBaseUrl: string): HostedShellState {
  return {
    activeTabId: 'session-a',
    tabs: [
      {
        id: 'session-a',
        sessionId: 'session-a',
        apiBaseUrl,
        createdAt: 1,
      },
    ],
  }
}

describe('hosted shell sync', () => {
  it('broadcasts written shell state to peer instances', () => {
    const storage = createMemoryStorage()
    const channelPair = createChannelPair()
    const primary = createHostedShellSync({
      storage,
      createChannel: () => channelPair.primary,
    })
    const secondary = createHostedShellSync({
      storage,
      createChannel: () => channelPair.secondary,
    })
    const states: HostedShellState[] = []

    const stop = secondary.start((state) => {
      states.push(state)
    })

    const nextState = createState('http://localhost:3100')
    primary.write(nextState)

    expect(states).toEqual([nextState])
    expect(secondary.readCurrent()).toEqual(nextState)

    stop()
  })

  it('syncNow pulls the latest state after external storage writes', () => {
    const storage = createMemoryStorage()
    const sync = createHostedShellSync({
      storage,
      createChannel: () => null,
    })
    const nextState = createState('http://localhost:3200')
    storage.setItem(getHostedShellStorageKey(), JSON.stringify(nextState))
    let received: HostedShellState | null = null

    const pulled = sync.syncNow((state) => {
      received = state
    })

    expect(pulled).toEqual(nextState)
    expect(received).toEqual(nextState)
  })
})
