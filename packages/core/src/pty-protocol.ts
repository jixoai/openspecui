import { z } from 'zod'

const PositiveInt = z.number().int().positive()

const PtySessionInfoSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  isExited: z.boolean(),
  exitCode: z.number().int().nullable(),
})

export const PtyCreateMessageSchema = z.object({
  type: z.literal('create'),
  requestId: z.string().min(1),
  cols: PositiveInt.optional(),
  rows: PositiveInt.optional(),
  command: z.string().min(1).optional(),
  args: z.array(z.string()).optional(),
})

export const PtyInputMessageSchema = z.object({
  type: z.literal('input'),
  sessionId: z.string().min(1),
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
  PtyResizeMessageSchema,
  PtyCloseMessageSchema,
  PtyAttachMessageSchema,
  PtyListMessageSchema,
])

export const PtyCreatedResponseSchema = z.object({
  type: z.literal('created'),
  requestId: z.string().min(1),
  sessionId: z.string().min(1),
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
])

export const PtyErrorResponseSchema = z.object({
  type: z.literal('error'),
  code: PtyErrorCodeSchema,
  message: z.string().min(1),
  sessionId: z.string().min(1).optional(),
})

export const PtyServerMessageSchema = z.discriminatedUnion('type', [
  PtyCreatedResponseSchema,
  PtyOutputResponseSchema,
  PtyExitResponseSchema,
  PtyTitleResponseSchema,
  PtyBufferResponseSchema,
  PtyListResponseSchema,
  PtyErrorResponseSchema,
])

export type PtyClientMessage = z.infer<typeof PtyClientMessageSchema>
export type PtyServerMessage = z.infer<typeof PtyServerMessageSchema>
export type PtySessionInfo = z.infer<typeof PtySessionInfoSchema>
