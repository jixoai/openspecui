/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Validate and route PTY WebSocket lifecycle messages.
 * 2. Create planning-target terminals inside the Manager-owned root operation lifetime.
 * 3. Attach/replay terminal output through a bounded, event-loop-fair batch owner.
 * 4. Publish terminal notifications without duplicating protocol fanout.
 * 5. Forward opaque planning-root generation evidence to the Server cwd owner.
 *
 * Original request (2026-07-16): "3.8 Terminal exposes explicit launch-project cwd and planning-root cwd while preserving inherited XDG_DATA_HOME"
 * Original request (2026-07-17): "A later root operation must not keep using an owner selected before replacement."
 * Owner-reported defect (2026-07-21): Starting an Agent terminal can starve the Server and page.
 * Owner-reported defect (2026-07-21): Pre-created Agent terminals are absent from Compose Send.
 */
import {
  PtyClientMessageSchema,
  TerminalControlParser,
  terminalNotificationEventToPublishInput,
  type PtyClientMessage,
  type PtyServerMessage,
  type TerminalControlEvent,
  type TerminalCwdTarget,
} from '@openspecui/core'
import type { WebSocket } from 'ws'
import { parsePtyAuthFirstMessage, type AccessGate } from './access-gate.js'
import type { NotificationService } from './notification-service.js'
import type { PtyManager, PtySession } from './pty-manager.js'
import { PtyOutputBatcher } from './pty-output-batcher.js'
import { limitPtyReplayBuffer, PtySocketSender } from './pty-socket-sender.js'

type PtyErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_MESSAGE'
  | 'SESSION_NOT_FOUND'
  | 'PTY_CREATE_FAILED'
  | 'UNAUTHORIZED'
type PtyErrorMessage = {
  type: 'error'
  code: PtyErrorCode
  message: string
  sessionId?: string
}
type PtyOutgoingMessage = PtyServerMessage | PtyErrorMessage
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
  notificationService: NotificationService | undefined,
  options: {
    withCwdTarget: <T>(
      target: TerminalCwdTarget,
      task: (cwd: {
        cwdTarget: TerminalCwdTarget
        cwd: string
        rootGeneration: string | null
      }) => Promise<T> | T,
      expectedRootGeneration?: string
    ) => Promise<T>
    /** Optional whole-backend Access Gate. When set, the first PTY message must authenticate. */
    accessGate?: AccessGate
  }
) {
  return (ws: WebSocket) => {
    // Track event listener cleanups for each attached session
    const cleanups = new Map<string, () => void>()
    const parsers = new Map<string, TerminalControlParser>()

    const sender = new PtySocketSender(ws)
    const send = (msg: PtyOutgoingMessage) => sender.send(msg)
    const sendError = (code: PtyErrorCode, message: string, opts?: { sessionId?: string }) => {
      send({ type: 'error', code, message, sessionId: opts?.sessionId })
    }

    // Access Gate: when configured, the connection must authenticate with one `{type:'auth',...}`
    // message before any command is accepted. A failed/rejected auth closes the socket.
    const gate = options.accessGate ?? null
    let authenticated = gate === null

    const attachToSession = (session: PtySession, opts?: { cols?: number; rows?: number }) => {
      const sessionId = session.id

      // If already attached, detach first
      cleanups.get(sessionId)?.()

      // Resize if dimensions provided
      if (opts?.cols && opts?.rows && !session.isExited) {
        session.resize(opts.cols, opts.rows)
      }

      // Set up event listeners
      const processOutputBatch = (data: string) => {
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
      const outputBatcher = new PtyOutputBatcher(processOutputBatch, () => sender.terminate())
      const onData = (data: string) => {
        outputBatcher.enqueue(data)
      }
      const onExit = (exitCode: number) => {
        outputBatcher.afterFlush(() => send({ type: 'exit', sessionId, exitCode }))
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
        outputBatcher.close()
        parsers.delete(sessionId)
        cleanups.delete(sessionId)
      })
    }

    ws.on('message', async (raw) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(raw))
      } catch {
        sendError('INVALID_JSON', 'Invalid JSON payload')
        return
      }

      // Access Gate first-message authentication. Until authenticated, only an `auth` message is
      // accepted; any other message is rejected and the socket is closed.
      if (!authenticated) {
        const authMessage = parsePtyAuthFirstMessage(parsed)
        if (!authMessage) {
          sendError('UNAUTHORIZED', 'Authentication required before any terminal command.')
          ws.close(4001, 'unauthorized')
          return
        }
        const outcome = gate?.check(authMessage.credential)
        if (!outcome || !outcome.ok) {
          sendError('UNAUTHORIZED', outcome?.reason ?? 'Authorization credential was rejected.')
          ws.close(4001, 'unauthorized')
          return
        }
        // Authentication succeeded: subsequent messages are processed as terminal commands.
        // No explicit ack is sent; the client proceeds once the socket remains open.
        authenticated = true
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
            await options.withCwdTarget(
              msg.cwdTarget,
              (cwd) => {
                const createMessage = msg as typeof msg & {
                  closeTip?: string
                  closeCallbackUrl?: string | Record<string, string>
                }
                const session = ptyManager.create({
                  cols: msg.cols,
                  rows: msg.rows,
                  command: msg.command,
                  args: msg.args,
                  cwdTarget: cwd.cwdTarget,
                  cwd: cwd.cwd,
                  rootGeneration: cwd.rootGeneration,
                  closeTip: createMessage.closeTip,
                  closeCallbackUrl: createMessage.closeCallbackUrl,
                })

                send({
                  type: 'created',
                  requestId: msg.requestId,
                  sessionId: session.id,
                  platform: session.platform,
                  cwdTarget: session.cwdTarget,
                  initialCwd: session.initialCwd,
                  rootGeneration: session.rootGeneration,
                })
                attachToSession(session)
              },
              msg.expectedRootGeneration
            )
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
            send({ type: 'buffer', sessionId: session.id, data: limitPtyReplayBuffer(buffer) })
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
              cwdTarget: s.cwdTarget,
              initialCwd: s.initialCwd,
              rootGeneration: s.rootGeneration,
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

        case 'workflow-input': {
          const session = ptyManager.get(msg.sessionId)
          if (!session) {
            send({
              type: 'workflow-input-rejected',
              requestId: msg.requestId,
              sessionId: msg.sessionId,
              message: `Session not found: ${msg.sessionId}`,
            })
            break
          }

          try {
            await options.withCwdTarget(
              'planning-root',
              ({ rootGeneration }) => {
                if (
                  rootGeneration === null ||
                  ptyManager.get(msg.sessionId) !== session ||
                  (session.cwdTarget === 'planning-root' &&
                    session.rootGeneration !== rootGeneration) ||
                  rootGeneration !== msg.expectedRootGeneration
                ) {
                  throw new Error(
                    'Selected terminal is unavailable or stale. Choose a Launch terminal or a current Planning terminal.'
                  )
                }
                if (session.write(msg.data) === false) {
                  throw new Error(
                    'Terminal input is backpressured or closed. Wait for the terminal to settle and retry.'
                  )
                }
              },
              msg.expectedRootGeneration
            )
            send({
              type: 'workflow-input-accepted',
              requestId: msg.requestId,
              sessionId: msg.sessionId,
            })
          } catch (error) {
            send({
              type: 'workflow-input-rejected',
              requestId: msg.requestId,
              sessionId: msg.sessionId,
              message: error instanceof Error ? error.message : String(error),
            })
          }
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
