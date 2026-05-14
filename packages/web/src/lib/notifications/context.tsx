import { navController } from '@/lib/nav-controller'
import { terminalController } from '@/lib/terminal-controller'
import { trpcClient } from '@/lib/trpc'
import { useNavLayout } from '@/lib/use-nav-controller'
import { useConfigSubscription, useNotificationsSubscription } from '@/lib/use-subscription'
import { vtNavController } from '@/lib/view-transitions/navigation'
import {
  groupNotifications,
  type NotificationAction,
  type NotificationGroup,
  type NotificationRecord,
} from '@openspecui/core/notifications'
import { DEFAULT_NOTIFICATION_SOUND_ID, type SoundId } from '@openspecui/core/sounds'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { resolveNotificationIconUrl } from './icon'
import { NotificationSoundEngine } from './sound-engine'

export interface ResolvedNotificationAction {
  action: NotificationAction
  disabled: boolean
  reason?: string
  run: () => Promise<void>
}

export interface NotificationContextValue {
  notifications: NotificationRecord[]
  latestNotification: NotificationRecord | null
  groups: NotificationGroup[]
  unreadCount: number
  highlightedId: string | null
  browserSupported: boolean
  browserPermission: NotificationPermission | 'unsupported'
  panelOpen: boolean
  openPanel: (highlightId?: string) => void
  requestBrowserPermission: () => Promise<NotificationPermission | 'unsupported'>
  previewSound: (sound?: SoundId, volume?: number) => Promise<void>
  resolveAction: (
    notification: NotificationRecord,
    action: NotificationAction,
    options?: { markReadOnRun?: boolean }
  ) => ResolvedNotificationAction
  markRead: (id: string) => Promise<void>
  markManyRead: (ids: readonly string[]) => Promise<void>
  clearGroup: (groupKey: string) => Promise<void>
  clearAll: () => Promise<void>
  clearTerminalSession: (sessionId: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | null>(null)

export function NotificationContextProvider({
  value,
  children,
}: {
  value: NotificationContextValue
  children: ReactNode
}) {
  return <NotificationContext value={value}>{children}</NotificationContext>
}

const NOOP_NOTIFICATION_CONTEXT: NotificationContextValue = {
  notifications: [],
  latestNotification: null,
  groups: [],
  unreadCount: 0,
  highlightedId: null,
  browserSupported: false,
  browserPermission: 'unsupported',
  panelOpen: false,
  openPanel: () => undefined,
  requestBrowserPermission: async () => 'unsupported',
  previewSound: async () => undefined,
  resolveAction: (_notification, action) => ({
    action,
    disabled: true,
    reason: 'Notifications are not available in this render tree.',
    run: async () => undefined,
  }),
  markRead: async () => undefined,
  markManyRead: async () => undefined,
  clearGroup: async () => undefined,
  clearAll: async () => undefined,
  clearTerminalSession: async () => undefined,
}

function getBrowserNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

function getBrowserPermission(): NotificationPermission | 'unsupported' {
  if (!getBrowserNotificationSupport()) return 'unsupported'
  return Notification.permission
}

function buildNotificationsHref(highlightId?: string): string {
  if (!highlightId) return '/notifications'
  const params = new URLSearchParams()
  params.set('highlight', highlightId)
  return `/notifications?${params.toString()}`
}

function formatBrowserNotificationTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function buildBrowserNotificationTitle(notification: NotificationRecord): string {
  return notification.body.trim() || notification.title
}

function buildBrowserNotificationBody(notifications: readonly NotificationRecord[]): string {
  const latest = notifications[0]
  if (!latest) return ''
  const time = formatBrowserNotificationTime(latest.createdAt)
  if (notifications.length <= 1) return `${time} - 1 unread`
  return `${time} - ${notifications.length} unread notifications`
}

async function revealTerminalPanel(): Promise<void> {
  const terminalArea = navController.getAreaForPath('/terminal')
  if (terminalArea === 'bottom') {
    await vtNavController.activateBottom('/terminal')
    return
  }

  await vtNavController.push('main', '/terminal', null)
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { data: notificationsData } = useNotificationsSubscription()
  const { data: config } = useConfigSubscription()
  const navLayout = useNavLayout()
  const notifications = notificationsData ?? []
  const groups = useMemo(() => groupNotifications(notifications), [notifications])
  const latestNotification = notifications[0] ?? null
  const [browserPermission, setBrowserPermission] = useState<
    NotificationPermission | 'unsupported'
  >(() => getBrowserPermission())
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const soundEngineRef = useRef<NotificationSoundEngine | null>(null)
  const previousLatestIdRef = useRef<string | null>(null)
  const browserNotificationRef = useRef<Notification | null>(null)
  const panelOpen = navLayout.popActive && navLayout.popLocation.pathname === '/notifications'
  const systemNotificationsEnabled = config?.notifications.systemNotificationsEnabled ?? false
  const sound = config?.notifications.sound ?? DEFAULT_NOTIFICATION_SOUND_ID
  const volume = config?.notifications.volume ?? 1

  useEffect(() => {
    const engine = new NotificationSoundEngine()
    engine.init()
    soundEngineRef.current = engine
  }, [])

  const openPanel = useCallback((highlightId?: string) => {
    if (typeof window !== 'undefined') {
      window.focus()
    }
    setHighlightedId(highlightId ?? null)
    void vtNavController.activatePop(buildNotificationsHref(highlightId))
  }, [])

  const markRead = useCallback(async (id: string) => {
    await trpcClient.notifications.markRead.mutate({ id })
  }, [])

  const markManyRead = useCallback(async (ids: readonly string[]) => {
    await trpcClient.notifications.markManyRead.mutate({ ids: [...ids] })
  }, [])

  const clearGroup = useCallback(async (groupKey: string) => {
    await trpcClient.notifications.clearGroup.mutate({ groupKey })
  }, [])

  const clearAll = useCallback(async () => {
    await trpcClient.notifications.clearAll.mutate()
  }, [])

  const clearTerminalSession = useCallback(async (sessionId: string) => {
    await trpcClient.notifications.clearTerminalSession.mutate({ sessionId })
  }, [])

  const requestBrowserPermission = useCallback(async () => {
    if (!getBrowserNotificationSupport()) {
      setBrowserPermission('unsupported')
      return 'unsupported'
    }

    const permission = await Notification.requestPermission()
    setBrowserPermission(permission)
    if (permission === 'granted') {
      await trpcClient.config.update.mutate({
        notifications: { systemNotificationsEnabled: true },
      })
    }
    return permission
  }, [])

  const previewSound = useCallback(
    async (nextSound?: SoundId, nextVolume?: number) => {
      await soundEngineRef.current?.play(nextSound ?? sound, nextVolume ?? volume)
    },
    [sound, volume]
  )

  const resolveAction = useCallback(
    (
      notification: NotificationRecord,
      action: NotificationAction,
      options?: { markReadOnRun?: boolean }
    ): ResolvedNotificationAction => {
      const markReadOnRun = options?.markReadOnRun ?? true

      if (action.type === 'terminal.focus') {
        const available = terminalController.hasServerSession(action.target.sessionId)
        return {
          action,
          disabled: !available,
          reason: available ? undefined : 'Target terminal is no longer available.',
          run: async () => {
            if (!terminalController.hasServerSession(action.target.sessionId)) return
            await vtNavController.deactivatePop()
            await revealTerminalPanel()
            if (!terminalController.requestActivateServerSession(action.target.sessionId)) return
            if (markReadOnRun) {
              await markRead(notification.id)
            }
          },
        }
      }

      return {
        action,
        disabled: false,
        run: async () => {
          const targetArea = navController.getAreaForPath(action.target.href)
          if (panelOpen) {
            await vtNavController.deactivatePop()
          }
          await vtNavController.push(targetArea, action.target.href, null)
          if (markReadOnRun) {
            await markRead(notification.id)
          }
        },
      }
    },
    [markRead, panelOpen]
  )

  useEffect(() => {
    const latestId = latestNotification?.id ?? null
    if (!latestId || previousLatestIdRef.current === latestId) {
      previousLatestIdRef.current = latestId
      return
    }
    previousLatestIdRef.current = latestId

    void soundEngineRef.current?.play(sound, volume).catch(() => {})

    if (
      !systemNotificationsEnabled ||
      panelOpen ||
      !getBrowserNotificationSupport() ||
      Notification.permission !== 'granted'
    ) {
      return
    }

    browserNotificationRef.current?.close()
    const browserNotification = new Notification(
      buildBrowserNotificationTitle(latestNotification),
      {
        body: buildBrowserNotificationBody(notifications),
        icon: resolveNotificationIconUrl(),
        tag: 'openspecui-notifications',
      }
    )
    browserNotification.onclick = () => {
      openPanel(latestNotification.id)
      browserNotification.close()
    }
    browserNotificationRef.current = browserNotification
  }, [
    latestNotification,
    notifications,
    openPanel,
    panelOpen,
    sound,
    systemNotificationsEnabled,
    volume,
  ])

  useEffect(() => {
    if (panelOpen) {
      browserNotificationRef.current?.close()
      browserNotificationRef.current = null
    }
  }, [panelOpen])

  useEffect(() => {
    if (navLayout.popLocation.pathname !== '/notifications') return
    const params = new URLSearchParams(navLayout.popLocation.search)
    setHighlightedId(params.get('highlight'))
  }, [navLayout.popLocation.pathname, navLayout.popLocation.search])

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      latestNotification,
      groups,
      unreadCount: notifications.length,
      highlightedId,
      browserSupported: getBrowserNotificationSupport(),
      browserPermission,
      panelOpen,
      openPanel,
      requestBrowserPermission,
      previewSound,
      resolveAction,
      markRead,
      markManyRead,
      clearGroup,
      clearAll,
      clearTerminalSession,
    }),
    [
      browserPermission,
      clearAll,
      clearGroup,
      clearTerminalSession,
      groups,
      highlightedId,
      latestNotification,
      markManyRead,
      markRead,
      notifications,
      openPanel,
      panelOpen,
      previewSound,
      requestBrowserPermission,
      resolveAction,
    ]
  )

  return <NotificationContextProvider value={value}>{children}</NotificationContextProvider>
}

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext)
  if (!ctx) {
    return NOOP_NOTIFICATION_CONTEXT
  }
  return ctx
}
