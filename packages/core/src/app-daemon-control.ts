/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Define the browser-safe daemon Workspace snapshot and invalidation wire contract.
 * 2. Keep runtime credentials typed but separate from persistent App shell state.
 * 3. Define the same-origin open-by-id acknowledgement without exposing backend targets.
 *
 * Original request (2026-07-29): "如果已经有 app daemon，那么默认投递到 app 中。"
 */
import { z } from 'zod'

/** Runtime-only Workspace authority delivered from the local daemon to its same-origin App shell. */
export const AppDaemonWorkspaceBindingSchema = z.object({
  id: z.string().min(1),
  backendUrl: z.string().url(),
  credential: z.string().min(1).nullable(),
})
export type AppDaemonWorkspaceBinding = z.infer<typeof AppDaemonWorkspaceBindingSchema>

/** Complete current daemon ledger; clients replace by revision instead of applying event deltas. */
export const AppDaemonWorkspaceSnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  workspaces: z.array(AppDaemonWorkspaceBindingSchema),
})
export type AppDaemonWorkspaceSnapshot = z.infer<typeof AppDaemonWorkspaceSnapshotSchema>

/** Invalidation carries ordering evidence only; the App always Pulls the complete replacement snapshot. */
export const AppDaemonInvalidationSchema = z.object({
  revision: z.number().int().nonnegative(),
})
export type AppDaemonInvalidation = z.infer<typeof AppDaemonInvalidationSchema>

/** Result of asking the daemon to open one currently registered opaque Workspace id. */
export const AppDaemonOpenWorkspaceResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.enum(['NOT_FOUND', 'PRESENTATION_FAILED']),
      message: z.string().min(1),
    }),
  }),
])
export type AppDaemonOpenWorkspaceResponse = z.infer<typeof AppDaemonOpenWorkspaceResponseSchema>
