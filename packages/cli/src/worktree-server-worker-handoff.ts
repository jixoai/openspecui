import type { GitWorktreeHandoff } from '@openspecui/core'
import type { GitWorktreeHandoffService } from '@openspecui/server'

export interface WorktreeHandoffRequestMessage {
  type: 'worktree-handoff:request'
  requestId: string
  targetPath: string
}

export interface WorktreeHandoffResultMessage {
  type: 'worktree-handoff:result'
  requestId: string
  handoff: GitWorktreeHandoff
}

export interface WorktreeHandoffErrorMessage {
  type: 'worktree-handoff:error'
  requestId: string
  message: string
  stack?: string
}

export type WorktreeHandoffWorkerMessage =
  | WorktreeHandoffRequestMessage
  | WorktreeHandoffResultMessage
  | WorktreeHandoffErrorMessage

interface WorktreeHandoffPort {
  postMessage(message: WorktreeHandoffWorkerMessage): void
  on(event: 'message', listener: (message: unknown) => void): unknown
  off(event: 'message', listener: (message: unknown) => void): unknown
}

interface WorktreeHandoffPostPort {
  postMessage(message: WorktreeHandoffWorkerMessage): void
}

let nextRequestId = 1

function createRequestId(): string {
  const requestId = `request-${nextRequestId}`
  nextRequestId += 1
  return requestId
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isWorktreeHandoffRequestMessage(
  value: unknown
): value is WorktreeHandoffRequestMessage {
  return (
    isRecord(value) &&
    value.type === 'worktree-handoff:request' &&
    typeof value.requestId === 'string' &&
    typeof value.targetPath === 'string'
  )
}

function isGitWorktreeHandoff(value: unknown): value is GitWorktreeHandoff {
  return (
    isRecord(value) && typeof value.projectDir === 'string' && typeof value.serverUrl === 'string'
  )
}

function isWorktreeHandoffResultMessage(
  value: unknown,
  requestId: string
): value is WorktreeHandoffResultMessage {
  return (
    isRecord(value) &&
    value.type === 'worktree-handoff:result' &&
    value.requestId === requestId &&
    isGitWorktreeHandoff(value.handoff)
  )
}

function isWorktreeHandoffErrorMessage(
  value: unknown,
  requestId: string
): value is WorktreeHandoffErrorMessage {
  return (
    isRecord(value) &&
    value.type === 'worktree-handoff:error' &&
    value.requestId === requestId &&
    typeof value.message === 'string' &&
    (value.stack === undefined || typeof value.stack === 'string')
  )
}

export function createParentPortWorktreeHandoffService(
  port: WorktreeHandoffPort
): GitWorktreeHandoffService {
  return {
    ensureWorktreeServer: (input: { targetPath: string }) => {
      const requestId = createRequestId()

      return new Promise<GitWorktreeHandoff>((resolve, reject) => {
        const onMessage = (message: unknown) => {
          if (isWorktreeHandoffResultMessage(message, requestId)) {
            port.off('message', onMessage)
            resolve(message.handoff)
            return
          }
          if (isWorktreeHandoffErrorMessage(message, requestId)) {
            port.off('message', onMessage)
            const error = new Error(message.message)
            error.stack = message.stack
            reject(error)
          }
        }

        port.on('message', onMessage)
        port.postMessage({
          type: 'worktree-handoff:request',
          requestId,
          targetPath: input.targetPath,
        })
      })
    },
  }
}

export function postWorktreeHandoffError(
  port: WorktreeHandoffPostPort,
  requestId: string,
  error: unknown
): void {
  if (error instanceof Error) {
    port.postMessage({
      type: 'worktree-handoff:error',
      requestId,
      message: error.message,
      stack: error.stack,
    })
    return
  }

  port.postMessage({
    type: 'worktree-handoff:error',
    requestId,
    message: String(error),
  })
}
