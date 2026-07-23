/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Define the type-safe PTY client/server transport protocol.
 * 2. Preserve explicit launch-project or planning-root cwd identity across create/list/reconnect.
 * 3. Carry terminal output, control metadata, lifecycle, and failure messages.
 * 4. Carry opaque planning-root generation evidence through PTY creation and guarded workflow input.
 *
 * Original request (2026-07-16): "3.8 Terminal exposes explicit launch-project cwd and planning-root cwd while preserving inherited XDG_DATA_HOME"
 * Owner-reported defect (2026-07-21): Same-generation Agent terminals are unavailable to Send.
 */
import { z } from 'zod'

const PositiveInt = z.number().int().positive()
export const PtyPlatformSchema = z.enum(['windows', 'macos', 'common'])
export const TerminalCwdTargetSchema = z.enum(['launch-project', 'planning-root'])
const CloseCallbackUrlSchema = z.union([z.string(), z.record(z.string())])

const PtySessionInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  platform: PtyPlatformSchema,
  isExited: z.boolean(),
  exitCode: z.number().int().nullable(),
  closeTip: z.string().optional(),
  closeCallbackUrl: CloseCallbackUrlSchema.optional(),
  cwdTarget: TerminalCwdTargetSchema,
  initialCwd: z.string().min(1),
  rootGeneration: z.string().min(1).nullable(),
})

export const PtyCreateMessageSchema = z.object({
  type: z.literal('create'),
  requestId: z.string().min(1),
  cols: PositiveInt.optional(),
  rows: PositiveInt.optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
  cwdTarget: TerminalCwdTargetSchema,
  /** Opaque planning-root generation captured by a Server workflow preparation. */
  expectedRootGeneration: z.string().min(1).optional(),
  closeTip: z.string().optional(),
  closeCallbackUrl: CloseCallbackUrlSchema.optional(),
})

export const PtyInputMessageSchema = z.object({
  type: z.literal('input'),
  sessionId: z.string().min(1),
  data: z.string(),
})

/** A workflow payload whose terminal and current Planning-root generation require Server approval. */
export const PtyWorkflowInputMessageSchema = z.object({
  type: z.literal('workflow-input'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  expectedRootGeneration: z.string().min(1),
  data: z.string(),
})

export const PtyResizeMessageSchema = z.object({
  type: z.literal('resize'),
  sessionId: z.string().min(1),
  cols: PositiveInt,
  rows: PositiveInt,
})

export const PtyCloseMessageSchema = z.object({
  type: z.literal('close'),
  sessionId: z.string().min(1),
})

export const PtyAttachMessageSchema = z.object({
  type: z.literal('attach'),
  sessionId: z.string().min(1),
  cols: PositiveInt.optional(),
  rows: PositiveInt.optional(),
})

export const PtyListMessageSchema = z.object({
  type: z.literal('list'),
})

export const PtyClientMessageSchema = z.discriminatedUnion('type', [
  PtyCreateMessageSchema,
  PtyInputMessageSchema,
  PtyWorkflowInputMessageSchema,
  PtyResizeMessageSchema,
  PtyCloseMessageSchema,
  PtyAttachMessageSchema,
  PtyListMessageSchema,
])

export const PtyCreatedResponseSchema = z.object({
  type: z.literal('created'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  platform: PtyPlatformSchema,
  cwdTarget: TerminalCwdTargetSchema,
  initialCwd: z.string().min(1),
  rootGeneration: z.string().min(1).nullable(),
})

/** Confirms that guarded workflow input reached the Server-owned PTY session. */
export const PtyWorkflowInputAcceptedResponseSchema = z.object({
  type: z.literal('workflow-input-accepted'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
})

/** Rejects guarded workflow input before PTY write while preserving the Server-owned reason. */
export const PtyWorkflowInputRejectedResponseSchema = z.object({
  type: z.literal('workflow-input-rejected'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().min(1),
})

export const PtyOutputResponseSchema = z.object({
  type: z.literal('output'),
  sessionId: z.string().min(1),
  data: z.string(),
})

export const PtyExitResponseSchema = z.object({
  type: z.literal('exit'),
  sessionId: z.string().min(1),
  exitCode: z.number().int(),
})

export const PtyTitleResponseSchema = z.object({
  type: z.literal('title'),
  sessionId: z.string().min(1),
  title: z.string(),
})

export const PtyProcessTitleResponseSchema = z.object({
  type: z.literal('process-title'),
  sessionId: z.string().min(1),
  title: z.string(),
})

export const PtyCwdResponseSchema = z.object({
  type: z.literal('cwd'),
  sessionId: z.string().min(1),
  cwd: z.string(),
})

export const PtyProgressResponseSchema = z.object({
  type: z.literal('progress'),
  sessionId: z.string().min(1),
  state: z.enum(['clear', 'set', 'error', 'indeterminate', 'warning']),
  value: z.number().int().min(0).max(100).nullable(),
})

export const PtyPromptStateResponseSchema = z.object({
  type: z.literal('prompt-state'),
  sessionId: z.string().min(1),
  state: z.enum(['prompt-start', 'prompt-end', 'command-start', 'command-output', 'command-end']),
  exitCode: z.number().int().optional(),
})

export const PtyBellResponseSchema = z.object({
  type: z.literal('bell'),
  sessionId: z.string().min(1),
  createdAt: z.number().int().positive().optional(),
})

export const PtyBufferResponseSchema = z.object({
  type: z.literal('buffer'),
  sessionId: z.string().min(1),
  data: z.string(),
})

export const PtyListResponseSchema = z.object({
  type: z.literal('list'),
  sessions: z.array(PtySessionInfoSchema),
})

export const PtyErrorCodeSchema = z.enum([
  'INVALID_JSON',
  'INVALID_MESSAGE',
  'SESSION_NOT_FOUND',
  'PTY_CREATE_FAILED',
  'UNAUTHORIZED',
])

export const PtyErrorResponseSchema = z.object({
  type: z.literal('error'),
  code: PtyErrorCodeSchema,
  message: z.string().min(1),
  sessionId: z.string().min(1).optional(),
})

export const PtyServerMessageSchema = z.discriminatedUnion('type', [
  PtyCreatedResponseSchema,
  PtyWorkflowInputAcceptedResponseSchema,
  PtyWorkflowInputRejectedResponseSchema,
  PtyOutputResponseSchema,
  PtyExitResponseSchema,
  PtyTitleResponseSchema,
  PtyProcessTitleResponseSchema,
  PtyCwdResponseSchema,
  PtyProgressResponseSchema,
  PtyPromptStateResponseSchema,
  PtyBellResponseSchema,
  PtyBufferResponseSchema,
  PtyListResponseSchema,
  PtyErrorResponseSchema,
])

export type PtyClientMessage = z.infer<typeof PtyClientMessageSchema>
export type PtyServerMessage = z.infer<typeof PtyServerMessageSchema>
export type PtySessionInfo = z.infer<typeof PtySessionInfoSchema>
export type PtyPlatform = z.infer<typeof PtyPlatformSchema>
export type TerminalCwdTarget = z.infer<typeof TerminalCwdTargetSchema>
