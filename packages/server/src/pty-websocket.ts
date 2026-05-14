import {
  PtyClientMessageSchema,
  TerminalControlParser,
  terminalNotificationEventToPublishInput,
  type PtyClientMessage,
  type PtyServerMessage,
  type TerminalControlEvent,
} from '@openspecui/core'
import type { WebSocket } from 'ws'
import type { NotificationService } from './notification-service.js'
import type { PtyManager, PtySession } from './pty-manager.js'

type PtyErrorCode = 'INVALID_JSON' | 'INVALID_MESSAGE' | 'SESSION_NOT_FOUND' | 'PTY_CREATE_FAILED'
type PtyErrorMessage = {
  type: 'error'
  code: PtyErrorCode
  message: string
  sessionId?: string
}
type PtyCreatedMessage = {
  type: 'created'
  requestId: string
  sessionId: string
  platform: 'windows' | 'macos' | 'common'
}
type PtyOutgoingMessage = PtyServerMessage | PtyErrorMessage | PtyCreatedMessage
type TerminalNotificationEvent = Extract<TerminalControlEvent, { type: 'notification' }>
type TerminalTitleEvent = Extract<TerminalControlEvent, { type: 'title' }>

function resolveTerminalTargetTitle(session: PtySession, title?: string): string {
  return title?.trim() || session.targetTitle || session.title || session.command
}

function updateTerminalTargetTitle(session: PtySession, event: TerminalTitleEvent): void {
  session.setTargetTitle(event.title, event.target)
}

function normalizeTerminalNotificationBody(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function getTerminalNotificationFanoutKey(event: TerminalNotificationEvent): string {
  const body = normalizeTerminalNotificationBody(event.body)
  return body || normalizeTerminalNotificationBody(event.title ?? '')
}

function coalesceTerminalNotificationFanout(
  events: readonly TerminalNotificationEvent[]
): TerminalNotificationEvent[] {
  const groups = new Map<string, TerminalNotificationEvent[]>()
  for (const event of events) {
    const key = getTerminalNotificationFanoutKey(event)
    const group = groups.get(key)
    if (group) {
      group.push(event)
    } else {
      groups.set(key, [event])
    }
  }
  return [...groups.values()].flatMap((group) => {
    const protocols = new Set(group.map((event) => event.protocol))
    if (protocols.size <= 1) return group
    return group.find((event) => event.title) ?? group[0] ?? []
  })
}

export function createPtyWebSocketHandler(
  ptyManager: PtyManager,
  notificationService?: NotificationService
) {
  return (ws: WebSocket) => {
    // Track event listener cleanups for each attached session
    const cleanups = new Map<string, () => void>()
    const parsers = new Map<string, TerminalControlParser>()

    const send = (msg: PtyOutgoingMessage) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(msg))
      }
    }
    const sendError = (code: PtyErrorCode, message: string, opts?: { sessionId?: string }) => {
      send({ type: 'error', code, message, sessionId: opts?.sessionId })
    }

    const attachToSession = (session: PtySession, opts?: { cols?: number; rows?: number }) => {
      const sessionId = session.id

      // If already attached, detach first
      cleanups.get(sessionId)?.()

      // Resize if dimensions provided
      if (opts?.cols && opts?.rows && !session.isExited) {
        session.resize(opts.cols, opts.rows)
      }

      // Set up event listeners
      const onData = (data: string) => {
        const parser = parsers.get(sessionId) ?? new TerminalControlParser()
        parsers.set(sessionId, parser)
        const parsed = parser.push(data)
        const notifications = coalesceTerminalNotificationFanout(
          parsed.events.filter(
            (event): event is TerminalNotificationEvent => event.type === 'notification'
          )
        )
        const notificationsToPublish = new Set(notifications)
        for (const event of parsed.events) {
          if (event.type === 'bell') {
            send({ type: 'bell', sessionId, createdAt: Date.now() })
            continue
          }
          if (event.type === 'notification') {
            if (!notificationsToPublish.has(event)) continue
            notificationService?.publish(
              terminalNotificationEventToPublishInput({
                event,
                sessionId,
                terminalTitle: resolveTerminalTargetTitle(session),
              })
            )
            continue
          }
          if (event.type === 'title') {
            const previousTargetTitle = session.targetTitle
            updateTerminalTargetTitle(session, event)
            const nextTargetTitle = resolveTerminalTargetTitle(session)
            if (nextTargetTitle !== previousTargetTitle) {
              send({
                type: 'title',
                sessionId,
                title: nextTargetTitle,
              })
            }
            continue
          }
          if (event.type === 'cwd') {
            send({ type: 'cwd', sessionId, cwd: event.cwd })
            continue
          }
          if (event.type === 'progress') {
            send({ type: 'progress', sessionId, state: event.state, value: event.value })
            continue
          }
          if (event.type === 'prompt-state') {
            send({
              type: 'prompt-state',
              sessionId,
              state: event.state,
              exitCode: event.exitCode,
            })
          }
        }
        if (parsed.output) {
          send({ type: 'output', sessionId, data: parsed.output })
        }
      }
      const onExit = (exitCode: number) => {
        send({ type: 'exit', sessionId, exitCode })
      }
      const onTitle = (title: string) => {
        send({ type: 'process-title', sessionId, title })
        send({ type: 'title', sessionId, title: resolveTerminalTargetTitle(session) })
      }

      session.on('data', onData)
      session.on('exit', onExit)
      session.on('title', onTitle)

      cleanups.set(sessionId, () => {
        session.removeListener('data', onData)
        session.removeListener('exit', onExit)
        session.removeListener('title', onTitle)
        parsers.delete(sessionId)
        cleanups.delete(sessionId)
      })
    }

    ws.on('message', (raw) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(raw))
      } catch {
        sendError('INVALID_JSON', 'Invalid JSON payload')
        return
      }

      const parsedMessage = PtyClientMessageSchema.safeParse(parsed)
      if (!parsedMessage.success) {
        const firstIssue = parsedMessage.error.issues[0]?.message
        sendError('INVALID_MESSAGE', firstIssue ?? 'Invalid PTY message')
        return
      }
      const msg: PtyClientMessage = parsedMessage.data

      switch (msg.type) {
        case 'create': {
          try {
            const createMessage = msg as typeof msg & {
              closeTip?: string
              closeCallbackUrl?: string | Record<string, string>
            }
            const session = ptyManager.create({
              cols: msg.cols,
              rows: msg.rows,
              command: msg.command,
              args: msg.args,
              closeTip: createMessage.closeTip,
              closeCallbackUrl: createMessage.closeCallbackUrl,
            })

            send({
              type: 'created',
              requestId: msg.requestId,
              sessionId: session.id,
              platform: session.platform,
            })
            attachToSession(session)
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err)
            sendError('PTY_CREATE_FAILED', errorMessage, { sessionId: msg.requestId })
          }
          break
        }

        case 'attach': {
          const session = ptyManager.get(msg.sessionId)
          if (!session) {
            sendError('SESSION_NOT_FOUND', `Session not found: ${msg.sessionId}`, {
              sessionId: msg.sessionId,
            })
            // Session doesn't exist — inform client it exited
            send({ type: 'exit', sessionId: msg.sessionId, exitCode: -1 })
            break
          }

          attachToSession(session, { cols: msg.cols, rows: msg.rows })

          // Replay buffer
          const buffer = session.getBuffer()
          if (buffer) {
            send({ type: 'buffer', sessionId: session.id, data: buffer })
          }

          // Send current title
          if (session.title) {
            send({ type: 'process-title', sessionId: session.id, title: session.title })
          }
          if (session.title || session.oscTitle) {
            send({
              type: 'title',
              sessionId: session.id,
              title: resolveTerminalTargetTitle(session),
            })
          }

          // If already exited, send exit event
          if (session.isExited) {
            send({ type: 'exit', sessionId: session.id, exitCode: session.exitCode ?? -1 })
          }

          break
        }

        case 'list': {
          const sessions = ptyManager.list()
          send({
            type: 'list',
            sessions: sessions.map((s) => ({
              id: s.id,
              title: s.title,
              command: s.command,
              args: s.args,
              platform: s.platform,
              isExited: s.isExited,
              exitCode: s.exitCode,
              closeTip: s.closeTip,
              closeCallbackUrl: s.closeCallbackUrl,
            })),
          })
          break
        }

        case 'input': {
          const session = ptyManager.get(msg.sessionId)
          if (!session) {
            sendError('SESSION_NOT_FOUND', `Session not found: ${msg.sessionId}`, {
              sessionId: msg.sessionId,
            })
            break
          }
          session.write(msg.data)
          break
        }

        case 'resize': {
          const session = ptyManager.get(msg.sessionId)
          if (!session) {
            sendError('SESSION_NOT_FOUND', `Session not found: ${msg.sessionId}`, {
              sessionId: msg.sessionId,
            })
            break
          }
          session.resize(msg.cols, msg.rows)
          break
        }

        case 'close': {
          const session = ptyManager.get(msg.sessionId)
          if (!session) {
            sendError('SESSION_NOT_FOUND', `Session not found: ${msg.sessionId}`, {
              sessionId: msg.sessionId,
            })
            break
          }
          cleanups.get(msg.sessionId)?.()
          ptyManager.close(session.id)
          break
        }
      }
    })

    // On WS close: detach all event listeners but keep sessions alive
    ws.on('close', () => {
      for (const cleanup of cleanups.values()) {
        cleanup()
      }
      cleanups.clear()
    })
  }
}
