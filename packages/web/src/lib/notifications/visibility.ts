import type { NotificationRecord } from '@openspecui/core/notifications'
import type { NavState } from '../nav-controller'
import { terminalController } from '../terminal-controller'

export function routeIsOpen(navLayout: NavState, href: string): boolean {
  const target = new URL(href, 'http://openspecui.local')
  const path = target.pathname
  return (
    navLayout.mainLocation.pathname === path ||
    navLayout.mainLocation.pathname.startsWith(`${path}/`) ||
    navLayout.bottomLocation.pathname === path ||
    navLayout.bottomLocation.pathname.startsWith(`${path}/`)
  )
}

function terminalNotificationTargetIsOpen(
  navLayout: NavState,
  notification: NotificationRecord
): boolean {
  if (notification.source.type !== 'terminal') return false
  const localSessionId = terminalController.getLocalSessionIdForServerSession(
    notification.source.sessionId
  )
  if (!localSessionId) return false
  return routeIsOpen(navLayout, '/terminal') && terminalController.isSessionActive(localSessionId)
}

export function notificationTargetPath(notification: NotificationRecord): string | null {
  const hrefAction = notification.actions.find((action) => action.type === 'href.open')
  if (hrefAction) {
    return new URL(hrefAction.target.href, 'http://openspecui.local').pathname
  }
  if (notification.actions.some((action) => action.type === 'terminal.focus')) {
    return '/terminal'
  }
  return null
}

export function notificationActionTargetIsOpen(
  navLayout: NavState,
  notification: NotificationRecord
): boolean {
  for (const action of notification.actions) {
    if (
      action.type === 'terminal.focus' &&
      terminalNotificationTargetIsOpen(navLayout, notification)
    ) {
      return true
    }
    if (action.type === 'href.open' && routeIsOpen(navLayout, action.target.href)) {
      return true
    }
  }
  return false
}

export function isNotificationsPanelOpen(navLayout: NavState): boolean {
  return navLayout.popActive && navLayout.popLocation.pathname === '/notifications'
}

export function shouldShowNotificationToast(input: {
  notification: NotificationRecord | null
  navLayout: NavState
}): boolean {
  const { notification, navLayout } = input
  if (!notification) return false
  if (isNotificationsPanelOpen(navLayout)) return false
  return !notificationActionTargetIsOpen(navLayout, notification)
}
