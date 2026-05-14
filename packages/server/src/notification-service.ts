import {
  NotificationPublishInputSchema,
  getNotificationGroupKey,
  type NotificationGroupKey,
  type NotificationPublishInput,
  type NotificationRecord,
} from '@openspecui/core/notifications'

export type NotificationListener = (notifications: NotificationRecord[]) => void

export class NotificationService {
  private notifications: NotificationRecord[] = []
  private listeners = new Set<NotificationListener>()
  private idCounter = 0

  list(): NotificationRecord[] {
    return [...this.notifications]
  }

  publish(input: NotificationPublishInput): NotificationRecord {
    const parsed = NotificationPublishInputSchema.parse(input)
    const groupKey = getNotificationGroupKey(parsed)
    const createdAt = parsed.createdAt ?? Date.now()

    const record: NotificationRecord = {
      ...parsed,
      id: `notification-${Date.now().toString(36)}-${(++this.idCounter).toString(36)}`,
      createdAt,
      groupKey,
    }

    this.notifications = [record, ...this.notifications]
    this.emit()
    return record
  }

  markRead(id: string): void {
    const next = this.notifications.filter((notification) => notification.id !== id)
    if (next.length === this.notifications.length) return
    this.notifications = next
    this.emit()
  }

  markManyRead(ids: readonly string[]): void {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    const next = this.notifications.filter((notification) => !idSet.has(notification.id))
    if (next.length === this.notifications.length) return
    this.notifications = next
    this.emit()
  }

  clearGroup(groupKey: NotificationGroupKey): void {
    const next = this.notifications.filter((notification) => notification.groupKey !== groupKey)
    if (next.length === this.notifications.length) return
    this.notifications = next
    this.emit()
  }

  clearTerminalSession(sessionId: string): void {
    const next = this.notifications.filter(
      (notification) =>
        notification.source.type !== 'terminal' || notification.source.sessionId !== sessionId
    )
    if (next.length === this.notifications.length) return
    this.notifications = next
    this.emit()
  }

  clearAll(): void {
    if (this.notifications.length === 0) return
    this.notifications = []
    this.emit()
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener)
    listener(this.list())
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    const snapshot = this.list()
    for (const listener of this.listeners) {
      listener(snapshot)
    }
  }
}
