/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Publish browser-safe lenient Spec/active-Change entry schemas for Store-content projection.
 * 2. Define the additive Store-content compatibility fact and demand-driven content kind.
 * 3. Keep this entry free of Node runtime dependencies for hosted browser consumers.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西，就跟 Config 和 Context 的关系一样。"
 * Derived boundary (2026-07-30): Store UI identity is `(backend-issued envUri, Store id)`; Store Detail
 *   shows readonly content summaries sourced from typed `list --specs|--changes --store <id>`.
 * Spec: hosted-environment-delivery › "Environment-Scoped Store Content Projection".
 *
 * Capability visibility is a compatibility fact, not authorization. A backend that omits
 * `stores.content.inspect` simply does not advertise the content projection; the App renders the
 * readonly content region as unsupported rather than inferring an empty Store.
 */
import { z } from 'zod'
import { StoreDiagnosticSchema } from './store-types.js'

/** One readonly Spec summary entry projected from `openspec list --specs --store <id> --json`. */
export const StoreContentSpecEntrySchema = z
  .object({
    id: z.string(),
    requirementCount: z.number(),
  })
  .passthrough()

/** One readonly active-Change summary projected from `openspec list --store <id> --json`. */
export const StoreContentChangeEntrySchema = z
  .object({
    name: z.string(),
    completedTasks: z.number(),
    totalTasks: z.number(),
    lastModified: z.string(),
    status: z.enum(['no-tasks', 'complete', 'in-progress']),
  })
  .passthrough()

/** Lenient projection of a Store's Spec-list content. */
export const StoreContentSpecListSchema = z
  .object({
    specs: z.array(StoreContentSpecEntrySchema).default([]),
    status: z.array(StoreDiagnosticSchema).optional(),
  })
  .passthrough()

/** Lenient projection of a Store's active-Change-list content. */
export const StoreContentChangeListSchema = z
  .object({
    changes: z.array(StoreContentChangeEntrySchema).default([]),
    status: z.array(StoreDiagnosticSchema).optional(),
  })
  .passthrough()

/** Demand-driven readonly Store content kind: Specs or active Changes. */
export const StoreContentKindSchema = z.enum(['specs', 'changes'])
export type StoreContentKind = z.infer<typeof StoreContentKindSchema>

/**
 * Additive hosted compatibility fact advertising a Store-content projection procedure.
 *
 * Presence authorizes nothing: a backend without it simply has no Store-content projection and the
 * App renders the content region as unsupported rather than inferring an empty Store.
 */
export const STORE_CONTENT_INSPECT_CAPABILITY = 'stores.content.inspect' as const

/** Browser-safe one-Store feature error shared with the Store list/Doctor envelope shape. */
const StoreContentFeatureErrorSchema = z
  .object({
    kind: z.string(),
    message: z.string(),
    cliVersion: z.string().optional(),
  })
  .passthrough()

/** Browser-safe Store-Specs projection wrapper returned by the hosted router. */
export const HostedStoreContentSpecsEnvelopeSchema = z
  .object({
    available: z.boolean(),
    specs: z.array(StoreContentSpecEntrySchema),
    storeId: z.string(),
    evidence: z.unknown().nullable().optional(),
    error: StoreContentFeatureErrorSchema.optional(),
    cliVersion: z.string().optional(),
  })
  .passthrough()

/** Browser-safe Store-active-Changes projection wrapper returned by the hosted router. */
export const HostedStoreContentChangesEnvelopeSchema = z
  .object({
    available: z.boolean(),
    changes: z.array(StoreContentChangeEntrySchema),
    storeId: z.string(),
    evidence: z.unknown().nullable().optional(),
    error: StoreContentFeatureErrorSchema.optional(),
    cliVersion: z.string().optional(),
  })
  .passthrough()

export type StoreContentSpecEntry = z.infer<typeof StoreContentSpecEntrySchema>
export type StoreContentChangeEntry = z.infer<typeof StoreContentChangeEntrySchema>
export type StoreContentSpecList = z.infer<typeof StoreContentSpecListSchema>
export type StoreContentChangeList = z.infer<typeof StoreContentChangeListSchema>
export type HostedStoreContentSpecsEnvelope = z.infer<typeof HostedStoreContentSpecsEnvelopeSchema>
export type HostedStoreContentChangesEnvelope = z.infer<
  typeof HostedStoreContentChangesEnvelopeSchema
>
