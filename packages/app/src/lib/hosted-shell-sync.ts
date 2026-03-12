import {
  getHostedShellStorageKey,
  loadHostedShellState,
  saveHostedShellState,
  type HostedShellState,
} from './shell-state'

const SHELL_SYNC_CHANNEL_NAME = 'openspecui-app:shell-sync'
const SHELL_SYNC_EVENT = 'shell-state'

export interface HostedShellSyncChannel {
  postMessage(message: HostedShellSyncMessage): void
  addEventListener(type: 'message', listener: EventListener): void
  removeEventListener(type: 'message', listener: EventListener): void
  close(): void
}

export interface HostedShellSyncRuntime {
  storage: Pick<Storage, 'getItem' | 'setItem'>
  addStorageListener?: (listener: (event: StorageEvent) => void) => void
  removeStorageListener?: (listener: (event: StorageEvent) => void) => void
  createChannel?: (name: string) => HostedShellSyncChannel | null
}

export interface HostedShellSyncMessage {
  key: string
  serialized: string
  type: typeof SHELL_SYNC_EVENT
}

function createBroadcastChannel(name: string): HostedShellSyncChannel | null {
  if (typeof BroadcastChannel === 'undefined') {
    return null
  }
  const channel = new BroadcastChannel(name)
  return {
    postMessage(message) {
      channel.postMessage(message)
    },
    addEventListener(type, listener) {
      channel.addEventListener(type, listener)
    },
    removeEventListener(type, listener) {
      channel.removeEventListener(type, listener)
    },
    close() {
      channel.close()
    },
  }
}

function serializeState(state: HostedShellState): string {
  return JSON.stringify(state)
}

function readSerializedState(storage: Pick<Storage, 'getItem'>): string {
  return storage.getItem(getHostedShellStorageKey()) ?? ''
}

function isSyncMessage(value: unknown): value is HostedShellSyncMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as HostedShellSyncMessage).type === SHELL_SYNC_EVENT &&
    typeof (value as HostedShellSyncMessage).key === 'string' &&
    typeof (value as HostedShellSyncMessage).serialized === 'string'
  )
}

export function createHostedShellSync(runtime: HostedShellSyncRuntime) {
  const key = getHostedShellStorageKey()
  const channel =
    runtime.createChannel?.(SHELL_SYNC_CHANNEL_NAME) ??
    createBroadcastChannel(SHELL_SYNC_CHANNEL_NAME)
  const addStorageListener =
    runtime.addStorageListener ??
    ((listener: (event: StorageEvent) => void) => {
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', listener)
      }
    })
  const removeStorageListener =
    runtime.removeStorageListener ??
    ((listener: (event: StorageEvent) => void) => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', listener)
      }
    })

  let lastSerialized = readSerializedState(runtime.storage)

  const syncFromStorage = (onState: (state: HostedShellState) => void): HostedShellState | null => {
    const nextSerialized = readSerializedState(runtime.storage)
    if (nextSerialized === lastSerialized) {
      return null
    }
    lastSerialized = nextSerialized
    const nextState = loadHostedShellState(runtime.storage)
    onState(nextState)
    return nextState
  }

  return {
    readCurrent() {
      return loadHostedShellState(runtime.storage)
    },
    write(state: HostedShellState) {
      const serialized = serializeState(state)
      lastSerialized = serialized
      saveHostedShellState(runtime.storage, state)
      channel?.postMessage({
        type: SHELL_SYNC_EVENT,
        key,
        serialized,
      })
    },
    syncNow(onState: (state: HostedShellState) => void) {
      return syncFromStorage(onState)
    },
    start(onState: (state: HostedShellState) => void) {
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key) return
        void syncFromStorage(onState)
      }
      const onMessage: EventListener = (event) => {
        const payload = (event as MessageEvent<unknown>).data
        if (!isSyncMessage(payload) || payload.key !== key) {
          return
        }
        void syncFromStorage(onState)
      }

      addStorageListener(onStorage)
      channel?.addEventListener('message', onMessage)

      return () => {
        removeStorageListener(onStorage)
        channel?.removeEventListener('message', onMessage)
        channel?.close()
      }
    },
  }
}
