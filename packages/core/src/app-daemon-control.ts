/**
 * Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
 * 1. Define the browser-safe daemon Workspace snapshot and invalidation wire contract.
 * 2. Keep runtime credentials typed but separate from persistent App shell state.
 * 3. Define the same-origin open-by-id acknowledgement without exposing backend targets.
 * 4. Define local-only managed directory start/Stop and path-first runtime evidence.
 *
 * Original request (2026-07-29): "如果已经有 app daemon，那么默认投递到 app 中。"
 */
import { z } from 'zod'

/** Runtime-only Workspace authority delivered from the local daemon to its same-origin App shell. */
export const AppDaemonWorkspaceBindingSchema = z.object({
  id: z.string().min(1),
  backendUrl: z.string().url(),
  credential: z.string().min(1).nullable(),
  projectDir: z.string().min(1),
  ownership: z.enum(['daemon-managed', 'external']),
  registeredAt: z.number().int().nonnegative(),
  managedGeneration: z.number().int().nonnegative().nullable(),
  shutdown: z.enum(['managed', 'external-owner', 'close-only']),
  git: z
    .object({
      remoteUrl: z.string().min(1).nullable(),
      branch: z.string().min(1).nullable(),
      githubSlug: z.string().min(1).nullable(),
    })
    .nullable(),
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

/** Same-origin request body for starting one daemon-managed project from a local directory. */
export const AppDaemonStartManagedProjectRequestSchema = z.object({
  projectDir: z.string().trim().min(1),
})
export type AppDaemonStartManagedProjectRequest = z.infer<
  typeof AppDaemonStartManagedProjectRequestSchema
>

/** Same-origin request body for stopping one exact daemon-managed generation. */
export const AppDaemonStopManagedProjectRequestSchema = z.object({
  generation: z.number().int().nonnegative(),
})
export type AppDaemonStopManagedProjectRequest = z.infer<
  typeof AppDaemonStopManagedProjectRequestSchema
>

const AppDaemonManagedProjectErrorSchema = z.object({
  code: z.enum([
    'UNSUPPORTED',
    'INVALID_DIRECTORY',
    'SPAWN_FAILED',
    'GENERATION_MISMATCH',
    'INVALID_REQUEST',
  ]),
  message: z.string().min(1),
})

/** Settled same-origin managed start response. Success means readiness and lease admission completed. */
export const AppDaemonStartManagedProjectResponseSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    workspace: AppDaemonWorkspaceBindingSchema,
    alreadyRunning: z.boolean(),
  }),
  z.object({ ok: z.literal(false), error: AppDaemonManagedProjectErrorSchema }),
])
export type AppDaemonStartManagedProjectResponse = z.infer<
  typeof AppDaemonStartManagedProjectResponseSchema
>

/** Settled same-origin exact-generation Stop response. */
export const AppDaemonStopManagedProjectResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), generation: z.number().int().nonnegative() }),
  z.object({ ok: z.literal(false), error: AppDaemonManagedProjectErrorSchema }),
])
export type AppDaemonStopManagedProjectResponse = z.infer<
  typeof AppDaemonStopManagedProjectResponseSchema
>
