/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Define the versioned daemon IPC request and response envelopes.
 * 2. Bound Workspace registration and browser-opening authority to opaque ids.
 * 3. Publish credential-free daemon status and structured failures.
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 */
import {
  AppDaemonWorkspaceBindingSchema,
  AppDaemonWorkspaceSnapshotSchema,
  type AppDaemonWorkspaceBinding,
  type AppDaemonWorkspaceSnapshot,
} from '@openspecui/core/app-daemon-control'
import { z } from 'zod'

export const DAEMON_PROTOCOL_VERSION = 1 as const
export const DaemonHostModeSchema = z.enum(['native', 'web'])
export type DaemonHostMode = z.infer<typeof DaemonHostModeSchema>

export const DaemonWorkspaceSchema = z.object({
  id: z.string().min(1),
  projectDir: z.string().min(1),
  backendUrl: z.string().url(),
  registeredAt: z.number().int().nonnegative(),
})
export type DaemonWorkspace = z.infer<typeof DaemonWorkspaceSchema>

/** Runtime-only App binding; credential is transported to memory and is never persisted. */
export const DaemonWorkspaceBindingSchema = AppDaemonWorkspaceBindingSchema
export type DaemonWorkspaceBinding = AppDaemonWorkspaceBinding

export const DaemonWorkspaceSnapshotSchema = AppDaemonWorkspaceSnapshotSchema
export type DaemonWorkspaceSnapshot = AppDaemonWorkspaceSnapshot

export const DaemonStatusSchema = z.object({
  version: z.string().min(1),
  pid: z.number().int().positive(),
  hostMode: DaemonHostModeSchema,
  appUrl: z.string().url().nullable(),
  capabilities: z.object({
    browser: z.boolean(),
    nativeWindow: z.boolean(),
  }),
})
export type DaemonStatus = z.infer<typeof DaemonStatusSchema>

const RegisterWorkspaceCommandSchema = z.object({
  type: z.literal('register-workspace'),
  workspace: z.object({
    id: z.string().min(1),
    projectDir: z.string().min(1),
    backendUrl: z.string().url(),
    credential: z.string().min(1).nullable(),
  }),
})

export const DaemonCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status') }),
  z.object({ type: z.literal('activate') }),
  RegisterWorkspaceCommandSchema,
  z.object({ type: z.literal('unregister-workspace'), workspaceId: z.string().min(1) }),
  z.object({ type: z.literal('open-workspace-in-browser'), workspaceId: z.string().min(1) }),
  z.object({ type: z.literal('list-workspaces') }),
  z.object({ type: z.literal('stop') }),
])
export type DaemonCommand = z.infer<typeof DaemonCommandSchema>

export const DaemonRequestSchema = z.object({
  protocol: z.literal(DAEMON_PROTOCOL_VERSION),
  id: z.string().min(1),
  command: DaemonCommandSchema,
})
export type DaemonRequest = z.infer<typeof DaemonRequestSchema>

const DaemonSuccessDataSchema = z.union([
  z.object({ kind: z.literal('status'), status: DaemonStatusSchema }),
  z.object({ kind: z.literal('ack') }),
  z.object({ kind: z.literal('stopped') }),
  z.object({ kind: z.literal('workspaces'), workspaces: z.array(DaemonWorkspaceSchema) }),
])
export type DaemonSuccessData = z.infer<typeof DaemonSuccessDataSchema>

export const DaemonResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    protocol: z.literal(DAEMON_PROTOCOL_VERSION),
    id: z.string().min(1),
    ok: z.literal(true),
    data: DaemonSuccessDataSchema,
  }),
  z.object({
    protocol: z.literal(DAEMON_PROTOCOL_VERSION),
    id: z.string().min(1),
    ok: z.literal(false),
    error: z.object({
      code: z.enum([
        'INVALID_REQUEST',
        'MODE_MISMATCH',
        'NOT_FOUND',
        'PRESENTATION_FAILED',
        'INTERNAL',
      ]),
      message: z.string(),
    }),
  }),
])
export type DaemonResponse = z.infer<typeof DaemonResponseSchema>
