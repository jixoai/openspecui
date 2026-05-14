import { Tooltip } from '@/components/tooltip'
import { navController } from '@/lib/nav-controller'
import { useNotifications, type ResolvedNotificationAction } from '@/lib/notifications/context'
import { resolveNotificationIconUrl } from '@/lib/notifications/icon'
import { notificationTargetPath, shouldShowNotificationToast } from '@/lib/notifications/visibility'
import { useNavLayout } from '@/lib/use-nav-controller'
import type { NotificationAction, NotificationRecord } from '@openspecui/core/notifications'
import { Check, ExternalLink } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const TOAST_TTL_MS = 5200
const TOAST_EXIT_MS = 340
const toastPrimaryIconButtonClassName =
  'border-primary bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-8 w-8 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50'

type ToastPhase = 'hidden' | 'entering' | 'visible' | 'exiting'

function formatToastMeta(notification: NotificationRecord, unreadCount: number): string {
  const time = new Date(notification.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${time} - ${unreadCount} unread`
}

function getToastTitle(notification: NotificationRecord): string {
  return notification.body.trim() || notification.title
}

function getActionIcon(actionType: NotificationAction['type']) {
  if (actionType === 'terminal.focus') return ExternalLink
  return ExternalLink
}

export function NotificationToastViewport() {
  const navLayout = useNavLayout()
  const { notifications, latestNotification, unreadCount, resolveAction, markRead } =
    useNotifications()
  const [toastNotification, setToastNotification] = useState<NotificationRecord | null>(null)
  const [phase, setPhase] = useState<ToastPhase>('hidden')
  const latestRenderedIdRef = useRef<string | null>(null)
  const autoHideTimerRef = useRef<number | null>(null)
  const exitTimerRef = useRef<number | null>(null)
  const targetPath = toastNotification ? notificationTargetPath(toastNotification) : null
  const targetArea = targetPath ? navController.getAreaForPath(targetPath) : 'main'
  const iconUrl = resolveNotificationIconUrl()

  const closeToast = useCallback(() => {
    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = null
    }
    setPhase((current) => (current === 'hidden' ? current : 'exiting'))
  }, [])

  useEffect(() => {
    const latestId = latestNotification?.id ?? null
    if (!latestNotification || latestRenderedIdRef.current === latestId) return
    latestRenderedIdRef.current = latestId

    if (!shouldShowNotificationToast({ notification: latestNotification, navLayout })) {
      closeToast()
      return
    }

    if (autoHideTimerRef.current !== null) {
      window.clearTimeout(autoHideTimerRef.current)
      autoHideTimerRef.current = null
    }
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
      exitTimerRef.current = null
    }

    setToastNotification(latestNotification)
    setPhase('entering')
    const enterFrame = window.requestAnimationFrame(() => {
      setPhase('visible')
    })
    autoHideTimerRef.current = window.setTimeout(() => {
      closeToast()
    }, TOAST_TTL_MS)

    return () => {
      window.cancelAnimationFrame(enterFrame)
    }
  }, [closeToast, latestNotification, navLayout])

  useEffect(() => {
    if (!toastNotification) return
    const stillUnread = notifications.some(
      (notification) => notification.id === toastNotification.id
    )
    if (stillUnread) return
    closeToast()
  }, [closeToast, notifications, toastNotification])

  useEffect(() => {
    if (phase !== 'exiting') return
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current)
    }
    exitTimerRef.current = window.setTimeout(() => {
      setToastNotification(null)
      setPhase('hidden')
      exitTimerRef.current = null
    }, TOAST_EXIT_MS)
    return () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current)
        exitTimerRef.current = null
      }
    }
  }, [phase])

  useEffect(
    () => () => {
      if (autoHideTimerRef.current !== null) window.clearTimeout(autoHideTimerRef.current)
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current)
    },
    []
  )

  const primaryAction = useMemo(() => {
    if (!toastNotification) return null
    const actions = toastNotification.actions.map((action) =>
      resolveAction(toastNotification, action, { markReadOnRun: true })
    )
    return actions.find((action) => !action.disabled) ?? actions[0] ?? null
  }, [resolveAction, toastNotification])

  if (!toastNotification || phase === 'hidden') return null

  return (
    <div
      className="notification-toast-viewport pointer-events-none fixed z-40"
      aria-live="polite"
      aria-atomic="true"
    >
      <article
        className="notification-toast pointer-events-auto"
        data-state={phase === 'exiting' ? 'closed' : 'open'}
        data-target-area={targetArea}
      >
        <div className="border-border/60 bg-background flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border">
          {iconUrl ? (
            <img src={iconUrl} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="bg-primary block h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-5">
            {getToastTitle(toastNotification)}
          </p>
          <p className="text-muted-foreground mt-1 truncate text-[11px] leading-none">
            {formatToastMeta(toastNotification, unreadCount)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {primaryAction ? (
            <NotificationToastAction resolved={primaryAction} onDone={closeToast} />
          ) : (
            <Tooltip content="Dismiss">
              <button
                type="button"
                onClick={() => {
                  void markRead(toastNotification.id).then(closeToast)
                }}
                className={toastPrimaryIconButtonClassName}
                aria-label="Dismiss notification"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </Tooltip>
          )}
        </div>
      </article>
    </div>
  )
}

function NotificationToastAction({
  resolved,
  onDone,
}: {
  resolved: ResolvedNotificationAction
  onDone: () => void
}) {
  const Icon = getActionIcon(resolved.action.type)
  return (
    <Tooltip content={resolved.disabled ? resolved.reason : resolved.action.label}>
      <button
        type="button"
        disabled={resolved.disabled}
        onClick={() => {
          void resolved.run().then(onDone)
        }}
        className={toastPrimaryIconButtonClassName}
        aria-label={resolved.action.label}
      >
        <Icon className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  )
}
