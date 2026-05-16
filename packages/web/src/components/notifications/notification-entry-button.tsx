import { CountBadge } from '@/components/badge'
import {
  TopLayerEntryButton,
  type TopLayerEntryButtonSize,
} from '@/components/layout/top-layer-entry-button'
import { useNotifications } from '@/lib/notifications/context'
import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'

interface NotificationEntryButtonProps {
  className?: string
  badgeClassName?: string
  iconClassName?: string
  size?: TopLayerEntryButtonSize
}

export function NotificationEntryButton({
  className,
  badgeClassName,
  iconClassName,
  size = 'mobile',
}: NotificationEntryButtonProps) {
  const { unreadCount, openPanel } = useNotifications()
  const label = unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'

  return (
    <TopLayerEntryButton
      label={label}
      icon={<Bell className={cn('h-4 w-4', iconClassName)} />}
      badge={
        unreadCount > 0 ? (
          <CountBadge
            count={unreadCount}
            className={cn('ring-background absolute -right-1.5 -top-1.5 ring-2', badgeClassName)}
            aria-hidden="true"
          />
        ) : undefined
      }
      size={size}
      className={className}
      onClick={() => openPanel()}
      data-notification-entry-button="true"
    />
  )
}
