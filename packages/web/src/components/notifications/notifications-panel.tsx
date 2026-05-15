import { CountBadge } from '@/components/badge'
import { usePopAreaConfigContext } from '@/components/layout/pop-area'
import { Tooltip } from '@/components/tooltip'
import { useNotifications } from '@/lib/notifications/context'
import type { NotificationAggregate, NotificationGroup } from '@openspecui/core/notifications'
import { Bell, Check, ChevronDown, ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const primaryNotificationButtonClassName =
  'border-primary bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs transition disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50'

const primaryNotificationIconButtonClassName =
  'border-primary bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-7 w-7 items-center justify-center rounded-md border transition disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:opacity-50'

function NotificationAggregateItem({ aggregate }: { aggregate: NotificationAggregate }) {
  const { highlightedId, markManyRead, resolveAction } = useNotifications()
  const notification = aggregate.latest
  const notificationIds = useMemo(
    () => aggregate.notifications.map((item) => item.id),
    [aggregate.notifications]
  )
  const actions = useMemo(
    () =>
      notification.actions.map((action) =>
        resolveAction(notification, action, { markReadOnRun: false })
      ),
    [notification, resolveAction]
  )
  const highlighted =
    highlightedId != null && aggregate.notifications.some((item) => item.id === highlightedId)

  return (
    <li
      className={[
        'notification-list-item grid transition-[grid-template-rows,opacity] duration-200 ease-out',
        highlighted ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[1fr] opacity-100',
      ].join(' ')}
      data-notification-id={notification.id}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={[
            'border-border/70 bg-background/80 rounded-md border p-3 transition-[background-color,border-color,box-shadow] duration-200',
            highlighted
              ? 'border-primary bg-primary/5 shadow-[inset_3px_0_0_var(--primary)]'
              : 'hover:bg-muted/30',
          ].join(' ')}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <div className="border-border/60 bg-muted/40 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border">
                  <Bell className="text-muted-foreground h-3.5 w-3.5" />
                </div>
                <h4 className="truncate text-sm font-medium">
                  {notification.title}
                  {aggregate.count > 1 && (
                    <CountBadge
                      count={aggregate.count}
                      tone="subtle"
                      size="sm"
                      shape="box"
                      className="ml-1 align-baseline"
                      aria-label={`${aggregate.count} identical notifications`}
                    />
                  )}
                </h4>
              </div>
              {notification.body && (
                <p className="text-muted-foreground mt-1 line-clamp-3 break-words text-xs">
                  {notification.body}
                </p>
              )}
            </div>
            <span className="text-muted-foreground text-xs">
              {formatTime(notification.createdAt)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {actions.map((resolved, index) => (
              <Tooltip key={index} content={resolved.disabled ? resolved.reason : undefined}>
                <button
                  type="button"
                  disabled={resolved.disabled}
                  onClick={() => {
                    void resolved.run().then(() => markManyRead(notificationIds))
                  }}
                  className={primaryNotificationButtonClassName}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {resolved.action.label}
                </button>
              </Tooltip>
            ))}
            <button
              type="button"
              onClick={() => void markManyRead(notificationIds)}
              className={`${primaryNotificationButtonClassName} ml-auto`}
            >
              <Check className="h-3.5 w-3.5" />
              Read
            </button>
          </div>
        </div>
      </div>
    </li>
  )
}

function NotificationGroupView({ group }: { group: NotificationGroup }) {
  const [expanded, setExpanded] = useState(group.aggregates.length <= 3)
  const { clearGroup } = useNotifications()
  const primaryAggregate = group.aggregates[0] ?? null
  const secondaryAggregates = group.aggregates.slice(1)
  const hasSecondaryAggregates = secondaryAggregates.length > 0

  return (
    <section className="notification-list-item grid grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out">
      <div className="min-h-0 overflow-hidden">
        <div className="border-border bg-background overflow-hidden rounded-md border">
          <header className="border-border bg-muted/25 flex items-center gap-3 border-b px-3 py-2">
            <button
              type="button"
              disabled={!hasSecondaryAggregates}
              onClick={() => setExpanded((value) => !value)}
              className="hover:bg-muted inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition disabled:cursor-default disabled:opacity-40"
              aria-label={expanded ? 'Collapse group' : 'Expand group'}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-medium">{group.label}</h3>
              <p className="text-muted-foreground text-xs">
                {group.unreadCount} notification{group.unreadCount === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clearGroup(group.key)}
              className={primaryNotificationIconButtonClassName}
              aria-label="Clear group"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </header>
          <ul className="space-y-2 p-2">
            {primaryAggregate && (
              <NotificationAggregateItem key={primaryAggregate.key} aggregate={primaryAggregate} />
            )}
            {hasSecondaryAggregates && (
              <li
                className={[
                  'duration-220 grid transition-[grid-template-rows,opacity] ease-out',
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                ].join(' ')}
              >
                <ul className="min-h-0 space-y-2 overflow-hidden">
                  {secondaryAggregates.map((aggregate) => (
                    <NotificationAggregateItem key={aggregate.key} aggregate={aggregate} />
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function NotificationsPanel() {
  const { setConfig } = usePopAreaConfigContext()
  const { groups, unreadCount, clearAll } = useNotifications()

  useEffect(() => {
    setConfig({
      layout: { alignY: 'start', width: 'normal', topGap: 'comfortable' },
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(88dvh,860px)',
      title: (
        <div className="min-w-0">
          <span className="font-nav block truncate tracking-[0.04em]">Notifications</span>
          <span className="text-muted-foreground block text-xs tracking-normal">
            {unreadCount} unread
          </span>
        </div>
      ),
      headerActions: (
        <button
          type="button"
          disabled={unreadCount === 0}
          onClick={() => void clearAll()}
          className={primaryNotificationButtonClassName}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear all
        </button>
      ),
      onDismissRequest: undefined,
    })
  }, [clearAll, setConfig, unreadCount])

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="scrollbar-thin scrollbar-track-transparent min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {groups.length === 0 ? (
          <div className="text-muted-foreground flex min-h-[14rem] flex-col items-center justify-center gap-2 rounded-md border border-dashed text-sm">
            <div className="border-border bg-muted/30 flex h-10 w-10 items-center justify-center rounded-md border">
              <Bell className="h-5 w-5" />
            </div>
            No notifications
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <NotificationGroupView key={group.key} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
