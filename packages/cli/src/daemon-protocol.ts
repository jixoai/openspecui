/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Define the versioned daemon IPC request and response envelopes.
 * 2. Bound Workspace registration and browser-opening authority to opaque ids.
 * 3. Publish credential-free daemon status and structured failures.
 * 4. Bound the authenticated managed-project start/stop control surface (P2 directory launch).
 *
 * Original request (2026-07-29): "多次执行 openspecui --app 只是在激活同一个 daemon。"
 * Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
 *   The daemon owns only project services started through this authenticated control; external
 *   foreground `serve` leases remain physically distinct and are never adopted or signaled.
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
  ownership: z.enum(['daemon-managed', 'external']).default('external'),
  managedGeneration: z.number().int().nonnegative().nullable().default(null),
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

/**
 * Authenticated request to start one managed project backend from a local directory.
 *
 * The daemon owns canonicalization, the fixed internal serve plan, and managed-child supervision.
 * Only the authenticated bundled local App control may issue this; the daemon rejects remote callers
 * and caller-supplied executable/argv. The credential, if any, is runtime-only and never persisted.
 */
const StartManagedProjectCommandSchema = z.object({
  type: z.literal('start-managed-project'),
  projectDir: z.string().min(1),
})

/** Authenticated request to Stop one exact managed project generation. */
const StopManagedProjectCommandSchema = z.object({
  type: z.literal('stop-managed-project'),
  generation: z.number().int().nonnegative(),
})

export const DaemonCommandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status') }),
  z.object({ type: z.literal('activate') }),
  RegisterWorkspaceCommandSchema,
  StartManagedProjectCommandSchema,
  StopManagedProjectCommandSchema,
  z.object({ type: z.literal('unregister-workspace'), workspaceId: z.string().min(1) }),
  z.object({ type: z.literal('open-workspace-in-browser'), workspaceId: z.string().min(1) }),
  z.object({ type: z.literal('list-workspaces') }),
  z.object({ type: z.literal('prepare-restart') }),
  z.object({ type: z.literal('stop') }),
])
export type DaemonCommand = z.infer<typeof DaemonCommandSchema>

export const DaemonRequestSchema = z.object({
  protocol: z.literal(DAEMON_PROTOCOL_VERSION),
  id: z.string().min(1),
  command: DaemonCommandSchema,
})
export type DaemonRequest = z.infer<typeof DaemonRequestSchema>

/**
 * Concrete startup state returned after one managed project start settles. The daemon owns the fixed
 * plan; the client receives only the reachable backend URL, the runtime credential, and the exact
 * generation to target for a later Stop.
 */
const ManagedProjectStartupDataSchema = z.object({
  canonicalProjectDir: z.string().min(1),
  backendUrl: z.string().url(),
  credential: z.string().min(1).nullable(),
  generation: z.number().int().nonnegative(),
  alreadyRunning: z.boolean(),
})

const DaemonSuccessDataSchema = z.union([
  z.object({ kind: z.literal('status'), status: DaemonStatusSchema }),
  z.object({ kind: z.literal('ack') }),
  z.object({ kind: z.literal('stopped') }),
  z.object({ kind: z.literal('workspaces'), workspaces: z.array(DaemonWorkspaceSchema) }),
  z.object({ kind: z.literal('restart-prepared'), projectDirs: z.array(z.string().min(1)) }),
  z.object({
    kind: z.literal('managed-project-started'),
    startup: ManagedProjectStartupDataSchema,
  }),
  z.object({
    kind: z.literal('managed-project-stopped'),
    generation: z.number().int().nonnegative(),
  }),
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
        'MANAGED_PROJECT_INVALID_DIRECTORY',
        'MANAGED_PROJECT_REMOTE_CALLER',
        'MANAGED_PROJECT_SPAWN_FAILED',
        'MANAGED_PROJECT_GENERATION_MISMATCH',
        'INTERNAL',
      ]),
      message: z.string(),
    }),
  }),
])
export type DaemonResponse = z.infer<typeof DaemonResponseSchema>
