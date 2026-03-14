import { generateHostedSessionId, type HostedShellLaunchRequest } from './shell-state'

const LEADER_STORAGE_KEY = 'openspecui-app:pwa-leader'
const LAUNCH_CHANNEL_NAME = 'openspecui-app:pwa-launch'
const LEADER_TTL_MS = 6000
const HEARTBEAT_INTERVAL_MS = 2000
const ACK_TIMEOUT_MS = 400

export type HostedLaunchRole = 'browser' | 'pwa'
export type HostedLaunchDispatchResult =
  | 'applied'
  | 'forwarded'
  | 'forwarded-to-pwa'
  | 'fallback-applied'

type HostedLaunchTimerHandle = number | ReturnType<typeof globalThis.setTimeout>
type HostedLaunchIntervalHandle = number | ReturnType<typeof globalThis.setInterval>

type HostedSetInterval = (handler: () => void, timeout: number) => HostedLaunchIntervalHandle

type HostedClearInterval = (timer: HostedLaunchIntervalHandle) => void

type HostedSetTimeout = (handler: () => void, timeout: number) => HostedLaunchTimerHandle

type HostedClearTimeout = (timer: HostedLaunchTimerHandle) => void

export interface HostedLaunchRelayMessageLaunch {
  type: 'launch'
  id: string
  sourceWindowId: string
  request: HostedShellLaunchRequest
}

export interface HostedLaunchRelayMessageAck {
  type: 'launch-ack'
  id: string
  targetWindowId: string
  leaderRole: HostedLaunchRole
}

export type HostedLaunchRelayMessage = HostedLaunchRelayMessageLaunch | HostedLaunchRelayMessageAck

export interface HostedLaunchRelayChannel {
  postMessage(message: HostedLaunchRelayMessage): void
  addEventListener(type: 'message', listener: EventListener): void
  removeEventListener(type: 'message', listener: EventListener): void
  close(): void
}

export interface HostedLaunchRelayRuntime {
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  createChannel?: (name: string) => HostedLaunchRelayChannel | null
  now?: () => number
  setInterval?: HostedSetInterval
  clearInterval?: HostedClearInterval
  setTimeout?: HostedSetTimeout
  clearTimeout?: HostedClearTimeout
  focusWindow?: () => void
  windowId?: string
  role?: HostedLaunchRole
}

interface LeaderRecord {
  windowId: string
  updatedAt: number
  role: HostedLaunchRole
}

interface PendingLaunch {
  request: HostedShellLaunchRequest
  timer: HostedLaunchTimerHandle
  resolve: (result: HostedLaunchDispatchResult) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHostedLaunchRole(value: unknown): value is HostedLaunchRole {
  return value === 'browser' || value === 'pwa'
}

function getHostedLaunchRolePriority(role: HostedLaunchRole): number {
  return role === 'pwa' ? 2 : 1
}

function detectHostedLaunchRole(): HostedLaunchRole {
  if (typeof window === 'undefined') {
    return 'browser'
  }

  const hostedNavigator = window.navigator as Navigator & { standalone?: boolean }
  const inStandaloneMode =
    hostedNavigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches

  return inStandaloneMode ? 'pwa' : 'browser'
}

function resolveForwardedLaunchResult(role: HostedLaunchRole): HostedLaunchDispatchResult {
  return role === 'pwa' ? 'forwarded-to-pwa' : 'forwarded'
}

function isHostedLaunchRequest(value: unknown): value is HostedShellLaunchRequest {
  return isRecord(value) && typeof value.apiBaseUrl === 'string'
}

function isLaunchMessage(value: unknown): value is HostedLaunchRelayMessageLaunch {
  return (
    isRecord(value) &&
    value.type === 'launch' &&
    typeof value.id === 'string' &&
    typeof value.sourceWindowId === 'string' &&
    isHostedLaunchRequest(value.request)
  )
}

function isAckMessage(value: unknown): value is HostedLaunchRelayMessageAck {
  return (
    isRecord(value) &&
    value.type === 'launch-ack' &&
    typeof value.id === 'string' &&
    typeof value.targetWindowId === 'string' &&
    isHostedLaunchRole(value.leaderRole)
  )
}

function parseLeaderRecord(raw: string | null): LeaderRecord | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return null
    if (typeof parsed.windowId !== 'string') return null
    if (typeof parsed.updatedAt !== 'number') return null
    return {
      windowId: parsed.windowId,
      updatedAt: parsed.updatedAt,
      role: isHostedLaunchRole(parsed.role) ? parsed.role : 'browser',
    }
  } catch {
    return null
  }
}

function createBroadcastLaunchChannel(name: string): HostedLaunchRelayChannel | null {
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

function focusCurrentWindow(): void {
  if (typeof window === 'undefined') {
    return
  }

  const userAgent = window.navigator.userAgent.toLowerCase()
  if (userAgent.includes('jsdom')) {
    return
  }

  try {
    window.focus()
  } catch {
    // Browsers may reject focus requests when not triggered by user action.
  }
}

export function readHostedLaunchLeader(storage: Pick<Storage, 'getItem'>): LeaderRecord | null {
  return parseLeaderRecord(storage.getItem(LEADER_STORAGE_KEY))
}

export function writeHostedLaunchLeader(
  storage: Pick<Storage, 'setItem'>,
  leader: LeaderRecord
): void {
  storage.setItem(LEADER_STORAGE_KEY, JSON.stringify(leader))
}

export function isHostedLaunchLeaderExpired(now: number, leader: LeaderRecord | null): boolean {
  return !leader || now - leader.updatedAt > LEADER_TTL_MS
}

export function createHostedLaunchRelay(runtime: HostedLaunchRelayRuntime) {
  const now = runtime.now ?? Date.now
  const channel =
    runtime.createChannel?.(LAUNCH_CHANNEL_NAME) ??
    createBroadcastLaunchChannel(LAUNCH_CHANNEL_NAME)
  const setIntervalImpl: HostedSetInterval =
    runtime.setInterval ?? ((handler, timeout) => globalThis.setInterval(handler, timeout))
  const clearIntervalImpl: HostedClearInterval =
    runtime.clearInterval ?? ((timer) => globalThis.clearInterval(timer))
  const setTimeoutImpl: HostedSetTimeout =
    runtime.setTimeout ?? ((handler, timeout) => globalThis.setTimeout(handler, timeout))
  const clearTimeoutImpl: HostedClearTimeout =
    runtime.clearTimeout ?? ((timer) => globalThis.clearTimeout(timer))
  const focusWindow = runtime.focusWindow ?? focusCurrentWindow
  const windowId = runtime.windowId ?? generateHostedSessionId()
  const role = runtime.role ?? detectHostedLaunchRole()
  const pending = new Map<string, PendingLaunch>()
  let onLaunch: ((request: HostedShellLaunchRequest) => void) | null = null
  let isLeader = false
  let heartbeatTimer: HostedLaunchIntervalHandle | null = null

  const refreshLeadership = () => {
    const current = readHostedLaunchLeader(runtime.storage)
    const currentNow = now()
    const shouldClaimLeadership =
      isHostedLaunchLeaderExpired(currentNow, current) ||
      current?.windowId === windowId ||
      getHostedLaunchRolePriority(role) > getHostedLaunchRolePriority(current?.role ?? 'browser')

    if (shouldClaimLeadership) {
      writeHostedLaunchLeader(runtime.storage, {
        windowId,
        updatedAt: currentNow,
        role,
      })
    }

    isLeader = readHostedLaunchLeader(runtime.storage)?.windowId === windowId
    return isLeader
  }

  const handleLaunchMessage = (message: HostedLaunchRelayMessageLaunch) => {
    if (!refreshLeadership() || !onLaunch) {
      return
    }

    onLaunch(message.request)
    focusWindow()
    channel?.postMessage({
      type: 'launch-ack',
      id: message.id,
      targetWindowId: message.sourceWindowId,
      leaderRole: role,
    })
  }

  const handleAckMessage = (message: HostedLaunchRelayMessageAck) => {
    if (message.targetWindowId !== windowId) {
      return
    }

    const pendingLaunch = pending.get(message.id)
    if (!pendingLaunch) {
      return
    }

    clearTimeoutImpl(pendingLaunch.timer)
    pending.delete(message.id)
    pendingLaunch.resolve(resolveForwardedLaunchResult(message.leaderRole))
  }

  const onChannelMessage: EventListener = (event) => {
    const payload = (event as MessageEvent<unknown>).data
    if (isLaunchMessage(payload)) {
      handleLaunchMessage(payload)
      return
    }
    if (isAckMessage(payload)) {
      handleAckMessage(payload)
    }
  }

  return {
    get windowId() {
      return windowId
    },
    get role() {
      return role
    },
    isLeader() {
      return refreshLeadership()
    },
    start(handler: (request: HostedShellLaunchRequest) => void) {
      onLaunch = handler
      refreshLeadership()
      heartbeatTimer = setIntervalImpl(() => {
        refreshLeadership()
      }, HEARTBEAT_INTERVAL_MS)
      channel?.addEventListener('message', onChannelMessage)

      return () => {
        if (heartbeatTimer !== null) {
          clearIntervalImpl(heartbeatTimer)
          heartbeatTimer = null
        }
        const leaderRole = readHostedLaunchLeader(runtime.storage)?.role ?? role
        for (const pendingLaunch of pending.values()) {
          clearTimeoutImpl(pendingLaunch.timer)
          pendingLaunch.resolve(resolveForwardedLaunchResult(leaderRole))
        }
        pending.clear()
        channel?.removeEventListener('message', onChannelMessage)
        channel?.close()
        if (readHostedLaunchLeader(runtime.storage)?.windowId === windowId) {
          runtime.storage.removeItem(LEADER_STORAGE_KEY)
        }
      }
    },
    async dispatch(request: HostedShellLaunchRequest): Promise<HostedLaunchDispatchResult> {
      if (!onLaunch) {
        throw new Error('Hosted launch relay must be started before dispatching launches')
      }

      if (refreshLeadership() || !channel) {
        onLaunch(request)
        focusWindow()
        return 'applied'
      }

      const id = generateHostedSessionId()
      channel.postMessage({
        type: 'launch',
        id,
        sourceWindowId: windowId,
        request,
      })

      return await new Promise<HostedLaunchDispatchResult>((resolve) => {
        const timer = setTimeoutImpl(() => {
          pending.delete(id)
          if (refreshLeadership()) {
            onLaunch?.(request)
            focusWindow()
            resolve('fallback-applied')
            return
          }

          const leaderRole = readHostedLaunchLeader(runtime.storage)?.role ?? role
          resolve(resolveForwardedLaunchResult(leaderRole))
        }, ACK_TIMEOUT_MS)

        pending.set(id, {
          request,
          timer,
          resolve,
        })
      })
    },
  }
}
