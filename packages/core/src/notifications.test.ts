import { describe, expect, it } from 'vitest'
import {
  TerminalNotificationParser,
  aggregateNotifications,
  getNotificationGroupKey,
  groupNotifications,
  terminalNotificationEventToPublishInput,
  type NotificationRecord,
} from './notifications.js'

describe('TerminalNotificationParser', () => {
  it('extracts BEL without removing ordinary output', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push('before\x07after')

    expect(result.output).toBe('beforeafter')
    expect(result.events).toEqual([{ type: 'bell' }])
  })

  it('extracts OSC 9 across chunks and removes the control sequence from output', () => {
    const parser = new TerminalNotificationParser()

    expect(parser.push('prompt \x1b]9;Build').output).toBe('prompt ')
    const result = parser.push(' finished\x07 done')

    expect(result.output).toBe(' done')
    expect(result.events).toEqual([
      { type: 'notification', protocol: 'osc9', body: 'Build finished' },
    ])
  })

  it('extracts OSC 777 notify with ST terminator', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push('\x1b]777;notify;Deploy;Ready\x1b\\')

    expect(result.output).toBe('')
    expect(result.events).toEqual([
      { type: 'notification', protocol: 'osc777', title: 'Deploy', body: 'Ready' },
    ])
  })

  it('consumes OSC 9;4 progress without publishing a notification', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push('a\x1b]9;4;3;\x07b\x1b]9;4;0;\x07c')

    expect(result.output).toBe('abc')
    expect(result.events).toEqual([
      { type: 'progress', state: 'indeterminate', value: null },
      { type: 'progress', state: 'clear', value: null },
    ])
  })

  it('extracts terminal title, cwd, and prompt state controls', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push(
      '\x1b]0;Claude Code\x07\x1b]7;file://host/Users/kzf/project\x07\x1b]133;A\x07\x1b]133;B\x07\x1b]133;C\x07\x1b]133;D;7\x07'
    )

    expect(result.output).toBe('')
    expect(result.events).toEqual([
      { type: 'title', title: 'Claude Code', target: 'both' },
      { type: 'cwd', cwd: '/Users/kzf/project' },
      { type: 'prompt-state', state: 'prompt-start' },
      { type: 'prompt-state', state: 'prompt-end' },
      { type: 'prompt-state', state: 'command-start' },
      { type: 'prompt-state', state: 'command-end', exitCode: 7 },
    ])
  })

  it('extracts VS Code and iTerm2 cwd shell integration controls', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push('\x1b]633;P;Cwd=/tmp/demo\x07\x1b]1337;CurrentDir=/tmp/iterm\x07')

    expect(result.output).toBe('')
    expect(result.events).toEqual([
      { type: 'cwd', cwd: '/tmp/demo' },
      { type: 'cwd', cwd: '/tmp/iterm' },
    ])
  })

  it('extracts ConEmu/OSC 9;9 cwd without treating it as a notification', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push('\x1b]9;9;/tmp/conemu\x07')

    expect(result.output).toBe('')
    expect(result.events).toEqual([{ type: 'cwd', cwd: '/tmp/conemu' }])
  })

  it('preserves unknown OSC sequences', () => {
    const parser = new TerminalNotificationParser()
    const result = parser.push('a\x1b]999;unknown\x07b')

    expect(result.output).toBe('a\x1b]999;unknown\x07b')
    expect(result.events).toEqual([])
  })
})

describe('notification helpers', () => {
  it('creates terminal focus publish input from a parsed event', () => {
    const input = terminalNotificationEventToPublishInput({
      event: { type: 'notification', protocol: 'osc777', title: 'Job', body: 'Done' },
      sessionId: 'pty-1',
      terminalTitle: 'Shell',
    })

    expect(input).toMatchObject({
      title: 'Job',
      body: 'Done',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'Shell' },
      actions: [{ type: 'terminal.focus', target: { sessionId: 'pty-1' } }],
    })
  })

  it('groups records by typed source metadata', () => {
    const base: Omit<NotificationRecord, 'id' | 'createdAt' | 'groupKey'> = {
      title: 'Build',
      body: '',
      level: 'info',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'Shell' },
      actions: [],
    }
    const records: NotificationRecord[] = [
      { ...base, id: '1', createdAt: 100, groupKey: getNotificationGroupKey(base) },
      { ...base, id: '2', createdAt: 200, groupKey: getNotificationGroupKey(base) },
    ]

    const groups = groupNotifications(records)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.unreadCount).toBe(2)
    expect(groups[0]!.latest.id).toBe('2')
    expect(groups[0]!.aggregates).toHaveLength(1)
    expect(groups[0]!.aggregates[0]!.count).toBe(2)
  })

  it('uses the latest notification source title as the group label snapshot', () => {
    const first: NotificationRecord = {
      id: '1',
      title: 'Build',
      body: '',
      level: 'info',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'zsh' },
      actions: [],
      createdAt: 100,
      groupKey: 'terminal:pty-1',
    }
    const latest: NotificationRecord = {
      ...first,
      id: '2',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'Claude Code' },
      createdAt: 200,
    }

    const groups = groupNotifications([first, latest])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.label).toBe('Claude Code')
    expect(groups[0]!.source).toEqual(latest.source)
  })

  it('aggregates identical notifications within a typed source group', () => {
    const base: Omit<NotificationRecord, 'id' | 'createdAt' | 'groupKey'> = {
      title: 'Terminal zsh has an event',
      body: '',
      level: 'info',
      source: { type: 'terminal', sessionId: 'pty-1', title: 'zsh' },
      actions: [
        {
          type: 'terminal.focus',
          label: 'Focus terminal',
          target: { sessionId: 'pty-1' },
        },
      ],
    }
    const groupKey = getNotificationGroupKey(base)
    const records: NotificationRecord[] = [
      { ...base, id: '1', createdAt: 100, groupKey },
      { ...base, id: '2', createdAt: 300, groupKey },
      {
        ...base,
        id: '3',
        title: 'Terminal zsh finished',
        createdAt: 200,
        groupKey,
      },
    ]

    const aggregates = aggregateNotifications(records)

    expect(aggregates).toHaveLength(2)
    expect(aggregates[0]!.latest.id).toBe('2')
    expect(aggregates[0]!.count).toBe(2)
    expect(aggregates[0]!.notifications.map((notification) => notification.id)).toEqual(['2', '1'])
  })
})
