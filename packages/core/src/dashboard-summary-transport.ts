/**
 * Orthogonal intents (created 2026-07-25 Asia/Shanghai):
 * 1. Define browser-safe opaque identity and wake-up contracts for Dashboard Summary v2.
 * 2. Define the typed Summary pull envelope without exposing Planning-root filesystem provenance.
 *
 * Original request (2026-07-23): "在已有content的时候，服务端推送变更，然后客户端收到推送通知，于是开始加载更新数据。"
 */
import { z } from 'zod'
import { DashboardSummaryProjectionSchema } from './dashboard-types.js'

/** Opaque Server-issued identity; it is derived from, but never contains, a Planning-root path. */
export const DashboardSummaryIdentitySchema = z
  .string()
  .regex(/^dashboard-summary-v2:[A-Za-z0-9_-]{43}$/)

export type DashboardSummaryIdentity = z.infer<typeof DashboardSummaryIdentitySchema>

/** Reasons that can wake the migrated Summary adapter in this bounded v2 slice. */
export const DashboardSummaryInvalidationCauseSchema = z.enum([
  'initial',
  'server-push',
  'root-rebind',
])

export type DashboardSummaryInvalidationCause = z.infer<
  typeof DashboardSummaryInvalidationCauseSchema
>

/** Data-free subscription event. Replacement Summary data always arrives through the typed pull. */
export const DashboardSummaryInvalidationSchema = z
  .object({
    identity: DashboardSummaryIdentitySchema,
    workGeneration: z.number().int().nonnegative(),
    cause: DashboardSummaryInvalidationCauseSchema,
  })
  .strict()

export type DashboardSummaryInvalidation = z.infer<typeof DashboardSummaryInvalidationSchema>

/** A current Summary read correlated to the exact Server-owned work identity and generation. */
export const DashboardSummaryReadSchema = z
  .object({
    identity: DashboardSummaryIdentitySchema,
    workGeneration: z.number().int().positive(),
    freshness: z.literal('current'),
    data: DashboardSummaryProjectionSchema,
  })
  .strict()

export type DashboardSummaryRead = z.infer<typeof DashboardSummaryReadSchema>
