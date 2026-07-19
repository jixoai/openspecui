/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Define distinct Project Binding, Active Root, and reactive Environment Global config projections.
 * 2. Inspect launch-project Store/Reference declarations without replacing CLI Root Context truth.
 * 3. Update only binding fields while preserving unrelated YAML fields and comments.
 * 4. Describe a typed launch-write result separately from asynchronous Root Context convergence.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Profile/Drift must refresh with external environment config changes."
 * Derived requirement (2026-07-19): "Project Binding returns launch-write, root preview, and transition evidence."
 */
import { isMap, parseDocument } from 'yaml'
import { z } from 'zod'
import type { CliCommandResult, CliJsonValue, CliRootSource } from './cli-contracts/index.js'
import type { CliResult } from './cli-executor.js'
import type { OpenSpecDataScope } from './open-spec-data-scope.js'
import type { RootContextError, RootContextResolvedState } from './root-context.js'

/** Runtime schema for JSON values accepted by OpenSpec global configuration. */
export const PlanningConfigJsonValueSchema: z.ZodType<CliJsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(PlanningConfigJsonValueSchema),
    z.record(z.string(), PlanningConfigJsonValueSchema),
  ])
)

/** Runtime schema for the complete environment-global OpenSpec configuration document. */
export const EnvironmentGlobalConfigValueSchema = z.record(
  z.string(),
  PlanningConfigJsonValueSchema
)

/** Runtime schema for one project-declared Store Reference entry. */
export const PlanningConfigReferenceSchema = z
  .object({
    id: z.string().min(1),
    remote: z.string().min(1).optional(),
  })
  .strict()

/** Normalized project-declared Store Reference entry. */
export type PlanningConfigReference = z.infer<typeof PlanningConfigReferenceSchema>

/** Runtime schema for project binding mutations. */
export const ProjectBindingUpdateSchema = z
  .object({
    store: z.string().min(1).nullable().optional(),
    references: z.array(PlanningConfigReferenceSchema).nullable().optional(),
  })
  .refine((value) => value.store !== undefined || value.references !== undefined, {
    message: 'At least one Project Binding field is required.',
  })

/** Validated project binding mutation. */
export type ProjectBindingUpdate = z.infer<typeof ProjectBindingUpdateSchema>

/** One configuration file and its current source content. */
export interface PlanningConfigFile {
  path: string | null
  format: 'yaml' | 'yml' | 'json'
  exists: boolean
  content: string | null
}

/** Objective parse or ownership diagnostic for a configuration projection. */
export interface PlanningConfigDiagnostic {
  code:
    | 'config-unparseable'
    | 'config-not-mapping'
    | 'store-not-string'
    | 'references-not-array'
    | 'reference-entry-invalid'
  message: string
}

/** Project Store binding state without registry inference. */
export type ProjectBindingStore =
  | { state: 'absent'; id: null }
  | { state: 'declared'; id: string }
  | { state: 'invalid'; id: null }

/** Project Reference declaration state and normalized entries. */
export interface ProjectBindingReferences {
  state: 'absent' | 'declared' | 'invalid'
  entries: PlanningConfigReference[]
}

/** Read-only inspection of project binding source and diagnostics. */
export interface ProjectBindingInspection {
  store: ProjectBindingStore
  references: ProjectBindingReferences
  diagnostics: PlanningConfigDiagnostic[]
}

/** Writable project binding projection. */
export interface ProjectBindingConfig {
  kind: 'project-binding'
  owner: { kind: 'launch-project'; path: string }
  file: PlanningConfigFile
  binding: ProjectBindingInspection
  rootPreview: RootContextResolvedState
}

/** Evidence that the launch project's binding file write completed. */
export interface ProjectBindingLaunchWrite {
  state: 'write-complete'
  owner: { kind: 'launch-project'; path: string }
  file: PlanningConfigFile
  binding: ProjectBindingInspection
  completedAt: number
}

/** Typed preview/convergence evidence for the asynchronous Planning-root transition. */
export type ProjectBindingTransition =
  | {
      id: string
      state: 'converging'
      observedAt: number
    }
  | {
      id: string
      /** The detached preview failed; the Manager transition has not been declared failed. */
      state: 'preview-error'
      observedAt: number
      error: RootContextError
    }

/**
 * Public mutation result: the completed launch write carries one correlated detached preview outcome.
 * A ready preview can only converge; an error preview can only report preview-error.
 */
export type ProjectBindingUpdateResult =
  | {
      kind: 'project-binding-update'
      launchWrite: ProjectBindingLaunchWrite
      rootPreview: Extract<RootContextResolvedState, { state: 'ready' }>
      transition: Extract<ProjectBindingTransition, { state: 'converging' }>
    }
  | {
      kind: 'project-binding-update'
      launchWrite: ProjectBindingLaunchWrite
      rootPreview: Extract<RootContextResolvedState, { state: 'error' }>
      transition: Extract<ProjectBindingTransition, { state: 'preview-error' }>
    }

/** Active Planning-root configuration and CLI-owned root provenance. */
export interface ActiveRootConfig {
  kind: 'active-root'
  owner: {
    kind: 'planning-root'
    path: string
    source: CliRootSource
    storeId: string | null
    externalToLaunchProject: boolean
  }
  file: PlanningConfigFile
}

/** CLI-owned profile and project-drift facts observed with environment-global config. */
export interface EnvironmentGlobalProfileState {
  available: boolean
  profile: 'core' | 'custom' | null
  delivery: 'both' | 'skills' | 'commands' | null
  workflows: string[]
  driftStatus: 'in-sync' | 'drift' | 'unknown'
  warningText: string | null
  error?: string
}

/** Environment-global configuration projection selected by the CLI. */
export interface EnvironmentGlobalConfig {
  kind: 'environment-global'
  owner: {
    kind: 'runtime-environment'
    dataScope: OpenSpecDataScope
  }
  file: PlanningConfigFile
  config: Record<string, CliJsonValue> | null
  profileState: EnvironmentGlobalProfileState
  evidence: {
    path: CliResult
    config: CliCommandResult<Record<string, CliJsonValue>>
    drift: CliResult
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function inspectReference(value: unknown): PlanningConfigReference | null {
  if (typeof value === 'string' && value.length > 0) return { id: value }
  if (!isRecord(value) || typeof value.id !== 'string' || value.id.length === 0) return null
  if (value.remote === undefined) return { id: value.id }
  if (typeof value.remote !== 'string' || value.remote.length === 0) return null
  return { id: value.id, remote: value.remote }
}

/** Inspect only launch-project binding declarations; Root Context remains the effective projection. */
export function inspectProjectBinding(content: string | null): ProjectBindingInspection {
  const absent: ProjectBindingInspection = {
    store: { state: 'absent', id: null },
    references: { state: 'absent', entries: [] },
    diagnostics: [],
  }
  if (content === null || content.trim().length === 0) return absent

  const document = parseDocument(content)
  if (document.errors.length > 0) {
    return {
      ...absent,
      diagnostics: [
        {
          code: 'config-unparseable',
          message: document.errors.map((error) => error.message).join('\n'),
        },
      ],
    }
  }

  const raw: unknown = document.toJS()
  if (raw === null) return absent
  if (!isRecord(raw)) {
    return {
      ...absent,
      diagnostics: [
        { code: 'config-not-mapping', message: 'OpenSpec config must be a YAML mapping.' },
      ],
    }
  }

  const diagnostics: PlanningConfigDiagnostic[] = []
  let store: ProjectBindingStore = { state: 'absent', id: null }
  if (raw.store !== undefined) {
    if (typeof raw.store === 'string' && raw.store.length > 0) {
      store = { state: 'declared', id: raw.store }
    } else {
      store = { state: 'invalid', id: null }
      diagnostics.push({
        code: 'store-not-string',
        message: 'The store field must be one non-empty Store id string.',
      })
    }
  }

  let references: ProjectBindingReferences = { state: 'absent', entries: [] }
  if (raw.references !== undefined) {
    if (!Array.isArray(raw.references)) {
      references = { state: 'invalid', entries: [] }
      diagnostics.push({
        code: 'references-not-array',
        message: 'The references field must be an array of Store declarations.',
      })
    } else {
      const entries: PlanningConfigReference[] = []
      let invalid = false
      for (const value of raw.references) {
        const reference = inspectReference(value)
        if (reference) entries.push(reference)
        else invalid = true
      }
      references = { state: invalid ? 'invalid' : 'declared', entries }
      if (invalid) {
        diagnostics.push({
          code: 'reference-entry-invalid',
          message: 'One or more Reference declarations are not a Store id or { id, remote }.',
        })
      }
    }
  }

  return { store, references, diagnostics }
}

/** Update only `store` and `references`, retaining all unrelated YAML nodes and comments. */
export function updateProjectBindingContent(
  content: string | null,
  update: ProjectBindingUpdate
): string {
  const document = parseDocument(content?.trim() ? content : '{}\n')
  if (document.errors.length > 0) {
    throw new Error(document.errors.map((error) => error.message).join('\n'))
  }
  if (document.contents !== null && !isMap(document.contents)) {
    throw new Error('OpenSpec config must be a YAML mapping before Project Binding can be edited.')
  }

  if (update.store !== undefined) {
    if (update.store === null) document.delete('store')
    else document.set('store', update.store)
  }
  if (update.references !== undefined) {
    if (update.references === null) {
      document.delete('references')
    } else {
      document.set(
        'references',
        update.references.map((reference) =>
          reference.remote === undefined ? reference.id : reference
        )
      )
    }
  }

  return document.toString({ lineWidth: 0 })
}
