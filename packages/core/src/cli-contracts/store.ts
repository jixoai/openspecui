/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Model the snake_case Store command family.
 * 2. Model root Doctor and Context relationship projections.
 * 3. Preserve healthy empty Stores and diagnostic failure null-shapes.
 *
 * Original request (2026-07-15): "Store/Context/Doctor 的 snake_case 与 workflow 的 camelCase 必须按官方合同处理。"
 */
import { z } from 'zod'
import {
  CliDiagnosticFailureSchema,
  CliDiagnosticSchema,
  CliReferenceIndexEntrySchema,
  CliRootSchema,
} from './common.js'

/** Registered Store identity and canonical root emitted by the CLI. */
export const CliStoreSchema = z
  .object({
    id: z.string(),
    root: z.string(),
    metadata_path: z.string().optional(),
  })
  .passthrough()

/** Strict typed result of the CLI Store-list JSON command. */
export const CliStoreListSchema = z
  .object({
    stores: z.array(CliStoreSchema),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

const CliStoreRegistryMutationSchema = z
  .object({
    path: z.string(),
    registered: z.boolean(),
    already_registered: z.boolean(),
  })
  .passthrough()

const CliStoreGitMutationSchema = z
  .object({
    is_repository: z.boolean(),
    initialized: z.boolean(),
    committed: z.boolean(),
  })
  .passthrough()

/** Strict Store setup/register mutation result. */
export const CliStoreMutationSchema = z
  .object({
    store: CliStoreSchema.nullable(),
    registry: CliStoreRegistryMutationSchema.nullable(),
    git: CliStoreGitMutationSchema.nullable(),
    created_files: z.array(z.string()),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

const CliStoreRegistryCleanupSchema = z
  .object({
    path: z.string(),
    removed: z.boolean(),
  })
  .passthrough()

const CliStoreFilesCleanupSchema = z
  .object({
    deleted: z.boolean(),
    deleted_path: z.string().nullable(),
    left_on_disk: z.string().nullable(),
  })
  .passthrough()

/** Strict Store unregister/remove cleanup result. */
export const CliStoreCleanupSchema = z
  .object({
    store: CliStoreSchema.nullable(),
    registry: CliStoreRegistryCleanupSchema.nullable(),
    files: CliStoreFilesCleanupSchema.nullable(),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

const CliPresenceSchema = z
  .object({
    present: z.boolean().nullable(),
  })
  .passthrough()

const CliOpenSpecRootInspectionSchema = z
  .object({
    present: z.boolean().nullable(),
    config: CliPresenceSchema,
    specs: CliPresenceSchema,
    changes: CliPresenceSchema,
    archive: CliPresenceSchema,
    healthy: z.boolean(),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

const CliStoreMetadataSchema = z
  .object({
    present: z.boolean().nullable(),
    valid: z.boolean().nullable(),
    id: z.string().nullable().optional(),
    remote: z.string().nullable().optional(),
  })
  .passthrough()

const CliStoreGitInspectionSchema = z
  .object({
    is_repository: z.boolean().nullable(),
    has_commits: z.boolean().nullable(),
    has_uncommitted_changes: z.boolean().nullable(),
    has_remote: z.boolean().nullable(),
    origin_url: z.string().nullable(),
  })
  .passthrough()

/** Strict Doctor facts for one registered Store. */
export const CliStoreDoctorEntrySchema = CliStoreSchema.extend({
  openspec_root: CliOpenSpecRootInspectionSchema,
  metadata: CliStoreMetadataSchema,
  git: CliStoreGitInspectionSchema,
  status: z.array(CliDiagnosticSchema),
}).passthrough()

/** Strict typed result of the CLI Store Doctor JSON command. */
export const CliStoreDoctorSchema = z
  .object({
    stores: z.array(CliStoreDoctorEntrySchema),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

const CliDoctorRootSchema = CliRootSchema.extend({
  healthy: z.boolean(),
  status: z.array(CliDiagnosticSchema),
}).passthrough()

const CliDoctorStoreSchema = z
  .object({
    id: z.string(),
    metadata: CliStoreMetadataSchema,
    origin_url: z.string().optional(),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

/** Root, Store, Reference, and diagnostic result of CLI Doctor. */
export const CliDoctorSchema = z
  .object({
    root: CliDoctorRootSchema.nullable(),
    store: CliDoctorStoreSchema.nullable(),
    references: z.array(CliReferenceIndexEntrySchema),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

const CliContextRootSchema = CliRootSchema.extend({
  role: z.literal('openspec_root'),
}).passthrough()

const CliContextMemberSchema = z
  .object({
    role: z.literal('referenced_store'),
    id: z.string(),
    path: z.string().optional(),
    remote: z.string().optional(),
    fetch: z.string().optional(),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

/** Root and direct referenced-Store relationship result of CLI Context. */
export const CliContextSchema = z
  .object({
    root: CliContextRootSchema.nullable(),
    members: z.array(CliContextMemberSchema),
    status: z.array(CliDiagnosticSchema),
  })
  .passthrough()

/** Known JSON documents that a Store-family command may emit on failure. */
export const CliStoreCommandFailureSchema = z.union([
  CliStoreMutationSchema,
  CliStoreCleanupSchema,
  CliStoreListSchema,
  CliStoreDoctorSchema,
  CliDiagnosticFailureSchema,
])

export type CliStore = z.infer<typeof CliStoreSchema>
export type CliStoreList = z.infer<typeof CliStoreListSchema>
export type CliStoreMutation = z.infer<typeof CliStoreMutationSchema>
export type CliStoreCleanup = z.infer<typeof CliStoreCleanupSchema>
export type CliStoreDoctorEntry = z.infer<typeof CliStoreDoctorEntrySchema>
export type CliStoreDoctor = z.infer<typeof CliStoreDoctorSchema>
export type CliDoctor = z.infer<typeof CliDoctorSchema>
export type CliContext = z.infer<typeof CliContextSchema>
