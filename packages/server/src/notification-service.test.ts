import { describe, expect, it } from 'vitest'
import { NotificationService } from './notification-service.js'

describe('NotificationService', () => {
  it('publishes records and emits updated snapshots', () => {
    const service = new NotificationService()
    const snapshots: number[] = []
    service.subscribe((items) => snapshots.push(items.length))

    const record = service.publish({
      title: 'Build',
      body: 'Done',
      source: { type: 'custom', groupId: 'build', title: 'Build' },
      actions: [],
      level: 'info',
    })

    expect(record.id).toMatch(/^notification-/)
    expect(record.groupKey).toBe('custom:build')
    expect(service.list()).toHaveLength(1)
    expect(snapshots).toEqual([0, 1])
  })

  it('burns records on read and group clear', () => {
    const service = new NotificationService()
    const first = service.publish({
      title: 'A',
      body: '',
      source: { type: 'custom', groupId: 'one' },
      actions: [],
      level: 'info',
    })
    service.publish({
      title: 'B',
      body: '',
      source: { type: 'custom', groupId: 'two' },
      actions: [],
      level: 'info',
    })

    service.markRead(first.id)
    expect(service.list().map((item) => item.title)).toEqual(['B'])

    service.clearGroup('custom:two')
    expect(service.list()).toEqual([])
  })

  it('burns multiple records in one read operation', () => {
    const service = new NotificationService()
    const first = service.publish({
      title: 'A',
      body: '',
      source: { type: 'custom', groupId: 'one' },
      actions: [],
      level: 'info',
      createdAt: 1000,
    })
    const second = service.publish({
      title: 'A',
      body: '',
      source: { type: 'custom', groupId: 'one' },
      actions: [],
      level: 'info',
      createdAt: 4000,
    })
    service.publish({
      title: 'B',
      body: '',
      source: { type: 'custom', groupId: 'one' },
      actions: [],
      level: 'info',
      createdAt: 5000,
    })

    service.markManyRead([first.id, second.id])

    expect(service.list().map((item) => item.title)).toEqual(['B'])
  })

  it('keeps duplicate records so clients can aggregate them with a count', () => {
    const service = new NotificationService()
    service.publish({
      title: 'Terminal zsh has an event',
      body: '',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'zsh' },
      actions: [],
      level: 'info',
      createdAt: 1000,
    })
    const record = service.publish({
      title: 'Terminal zsh has an event',
      body: '',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'zsh' },
      actions: [],
      level: 'info',
      createdAt: 1200,
    })

    expect(service.list()).toHaveLength(2)
    expect(record.createdAt).toBe(1200)
  })
})
