import {
  PtyClientMessageSchema,
  type PtyClientMessage,
  type PtyServerMessage,
} from '@openspecui/core'
import type { WebSocket } from 'ws'
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

export function createPtyWebSocketHandler(ptyManager: PtyManager) {
  return (ws: WebSocket) => {
    // Track event listener cleanups for each attached session
    const cleanups = new Map<string, () => void>()

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
        send({ type: 'output', sessionId, data })
      }
      const onExit = (exitCode: number) => {
        send({ type: 'exit', sessionId, exitCode })
      }
      const onTitle = (title: string) => {
        send({ type: 'title', sessionId, title })
      }

      session.on('data', onData)
      session.on('exit', onExit)
      session.on('title', onTitle)

      cleanups.set(sessionId, () => {
        session.removeListener('data', onData)
        session.removeListener('exit', onExit)
        session.removeListener('title', onTitle)
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
            const session = ptyManager.create({
              cols: msg.cols,
              rows: msg.rows,
              command: msg.command,
              args: msg.args,
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
            send({ type: 'title', sessionId: session.id, title: session.title })
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
