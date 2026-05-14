import { z } from 'zod'
import {
  DEFAULT_NOTIFICATION_SOUND_ID,
  SoundConfigIdSchema,
  SoundVolumeSchema,
  type SoundId,
} from './sounds.js'
import {
  TerminalControlParser,
  terminalNotificationEventToPublishInput,
  type TerminalControlEvent,
  type TerminalControlParseResult,
} from './terminal-control.js'

export const NOTIFICATION_SOUND_VALUES = ['silent', 'soft', 'clear', 'pulse'] as const
export const NotificationSoundSchema = SoundConfigIdSchema
export type NotificationSound = SoundId

export const NOTIFICATION_SOUND_OPTIONS: readonly {
  id: NotificationSound
  label: string
}[] = [
  { id: 'silent', label: 'Silent' },
  { id: DEFAULT_NOTIFICATION_SOUND_ID, label: 'Blow' },
]

export const NotificationSettingsSchema = z.object({
  sound: NotificationSoundSchema.default(DEFAULT_NOTIFICATION_SOUND_ID),
  volume: SoundVolumeSchema,
  systemNotificationsEnabled: z.boolean().default(false),
})
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>

export const NotificationSourceSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('terminal'),
    sessionId: z.string().min(1),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('openspec-change'),
    changeId: z.string().min(1),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('hooks-plugin'),
    pluginId: z.string().min(1),
    title: z.string().optional(),
  }),
  z.object({
    type: z.literal('custom'),
    groupId: z.string().min(1),
    title: z.string().optional(),
  }),
])
export type NotificationSource = z.infer<typeof NotificationSourceSchema>

export const NotificationActionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('terminal.focus'),
    label: z.string().default('Focus terminal'),
    target: z.object({
      sessionId: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal('href.open'),
    label: z.string().default('Open'),
    target: z.object({
      href: z.string().min(1),
    }),
  }),
])
export type NotificationAction = z.infer<typeof NotificationActionSchema>

export const NotificationGroupKeySchema = z.string().min(1)
export type NotificationGroupKey = z.infer<typeof NotificationGroupKeySchema>

export const NotificationPublishInputSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().max(2000).default(''),
  source: NotificationSourceSchema,
  actions: z.array(NotificationActionSchema).default([]),
  level: z.enum(['info', 'success', 'warning', 'error']).default('info'),
  createdAt: z.number().int().positive().optional(),
})
export type NotificationPublishInput = z.infer<typeof NotificationPublishInputSchema>

export const NotificationRecordSchema = NotificationPublishInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.number().int().positive(),
  groupKey: NotificationGroupKeySchema,
})
export type NotificationRecord = z.infer<typeof NotificationRecordSchema>

export interface NotificationAggregate {
  key: string
  notifications: NotificationRecord[]
  latest: NotificationRecord
  count: number
}

export interface NotificationGroup {
  key: NotificationGroupKey
  label: string
  source: NotificationSource
  notifications: NotificationRecord[]
  aggregates: NotificationAggregate[]
  latest: NotificationRecord
  unreadCount: number
}

export function getNotificationGroupKey(notification: {
  source: NotificationSource
}): NotificationGroupKey {
  const { source } = notification
  if (source.type === 'terminal') return `terminal:${source.sessionId}`
  if (source.type === 'openspec-change') return `openspec-change:${source.changeId}`
  if (source.type === 'hooks-plugin') return `hooks-plugin:${source.pluginId}`
  return `custom:${source.groupId}`
}

export function getNotificationGroupLabel(source: NotificationSource): string {
  if (source.type === 'terminal') return source.title?.trim() || `Terminal ${source.sessionId}`
  if (source.type === 'openspec-change') return source.title?.trim() || `Change ${source.changeId}`
  if (source.type === 'hooks-plugin') return source.title?.trim() || `Plugin ${source.pluginId}`
  return source.title?.trim() || source.groupId
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function getNotificationAggregateKey(notification: NotificationRecord): string {
  return stableStringify({
    groupKey: notification.groupKey,
    title: notification.title,
    body: notification.body,
    source: notification.source,
    actions: notification.actions,
    level: notification.level,
  })
}

export function aggregateNotifications(
  notifications: readonly NotificationRecord[]
): NotificationAggregate[] {
  const aggregates = new Map<string, NotificationRecord[]>()
  for (const notification of notifications) {
    const key = getNotificationAggregateKey(notification)
    const aggregate = aggregates.get(key)
    if (aggregate) {
      aggregate.push(notification)
    } else {
      aggregates.set(key, [notification])
    }
  }

  return [...aggregates.entries()]
    .map(([key, items]) => {
      const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt)
      const latest = sortedItems[0]
      return {
        key,
        notifications: sortedItems,
        latest,
        count: sortedItems.length,
      } satisfies NotificationAggregate
    })
    .sort((a, b) => b.latest.createdAt - a.latest.createdAt)
}

export function groupNotifications(
  notifications: readonly NotificationRecord[]
): NotificationGroup[] {
  const groups = new Map<NotificationGroupKey, NotificationRecord[]>()
  for (const notification of notifications) {
    const group = groups.get(notification.groupKey)
    if (group) {
      group.push(notification)
    } else {
      groups.set(notification.groupKey, [notification])
    }
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt)
      const latest = sortedItems[0]
      return {
        key,
        label: getNotificationGroupLabel(latest.source),
        source: latest.source,
        notifications: sortedItems,
        aggregates: aggregateNotifications(sortedItems),
        latest,
        unreadCount: sortedItems.length,
      } satisfies NotificationGroup
    })
    .sort((a, b) => b.latest.createdAt - a.latest.createdAt)
}

export { TerminalControlParser, terminalNotificationEventToPublishInput }
export type TerminalNotificationEvent = TerminalControlEvent
export type TerminalNotificationParseResult = TerminalControlParseResult
export const TerminalNotificationParser = TerminalControlParser
