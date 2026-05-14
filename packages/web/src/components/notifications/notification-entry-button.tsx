import { Tooltip } from '@/components/tooltip'
import { useNotifications } from '@/lib/notifications/context'
import { cn } from '@/lib/utils'
import { Bell } from 'lucide-react'

interface NotificationEntryButtonProps {
  className?: string
  badgeClassName?: string
  iconClassName?: string
}

export function NotificationEntryButton({
  className,
  badgeClassName,
  iconClassName,
}: NotificationEntryButtonProps) {
  const { unreadCount, openPanel } = useNotifications()
  const label = unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'

  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={() => openPanel()}
        className={cn(
          'border-border bg-background hover:bg-muted hover:border-primary/70 relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition active:translate-y-px',
          className
        )}
        aria-label={label}
        title={label}
        data-notification-entry-button="true"
      >
        <Bell className={cn('h-4 w-4', iconClassName)} />
        {unreadCount > 0 && (
          <span
            className={cn(
              'bg-primary ring-background text-primary-foreground absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 ring-2',
              badgeClassName
            )}
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </Tooltip>
  )
}
