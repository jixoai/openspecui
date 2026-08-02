/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Define the publication-safe snapshot contract shared by CLI export and static Web projection.
 * 2. Preserve exact CLI-selected Root provenance, including OpenSpec 1.7 machine default Store fallback.
 * 3. Keep Reference publication policy explicit without leaking private runtime evidence.
 *
 * Original request (2026-08-01): adapt OpenSpecUI 7 to the OpenSpec 1.7 Root and Store protocol.
 */
import type { OpenSpecUIConfig } from './config.js'
import type { OpsxEntityDetail } from './opsx-entity.js'
import type { SchemaDetail, SchemaInfo, SchemaResolution, TemplatesMap } from './opsx-types.js'
import type { SpecIdentity } from './spec-catalog.js'
import type { DocumentChecklistSummary, TrackedTaskProgress } from './task-progress.js'

/** Source from which the CLI resolved the exported writable planning root. */
export type ExportRootSource = 'nearest' | 'declared' | 'store' | 'global_default' | 'implicit'

/** Root provenance captured by CLI selection instead of an assumed launch projectDir. */
export interface ExportRootProvenance {
  /** Display-safe planning-root path; absolute paths are redacted before publication. */
  planningRootPath: string | null
  /** How the CLI resolved the planning root. */
  rootSource: ExportRootSource
  /** Effective Store id when the writable root was selected through an explicit Store. */
  storeId: string | null
}

/**
 * Reference export policy recorded on the snapshot.
 *
 * - `none`: no effective References were observed; owned-only export.
 * - `omit`: References were observed but intentionally excluded; only an aggregate count is retained.
 * - `include`: direct Reference Specs were materialized; per-Store provenance is retained.
 */
export type ExportReferencePolicy =
  | { kind: 'none' }
  | { kind: 'omit'; referenceSourceCount: number }
  | {
      kind: 'include'
      referenceSources: Array<{
        storeId: string
        state: 'ready' | 'error'
        specCount: number
      }>
    }

/**
 * Complete snapshot of an OpenSpec project for static export
 */
export interface ExportSnapshot {
  /** Snapshot metadata */
  meta: {
    timestamp: string
    /** Monotonic observation time of the CLI-resolved snapshot. */
    observedAt: number
    version: string
    /**
     * Display-safe project label. Absolute project paths are intentionally NOT retained; publication
     * redaction strips machine-sensitive locations and this field carries only a human-readable name.
     */
    projectName: string
    /** CLI-resolved writable planning-root provenance (not an absolute launch path). */
    root?: ExportRootProvenance
    /** Reference export policy observed and applied during this snapshot. */
    referencePolicy?: ExportReferencePolicy
  }
  /** Dashboard summary data */
  dashboard: {
    specsCount: number
    changesCount: number
    archivesCount: number
  }
  /** Git snapshot used by static dashboard */
  git?: {
    defaultBranch: string
    repositoryUrl: string | null
    latestCommitTs: number | null
    recentCommits: Array<{
      hash: string
      title: string
      committedAt: number
      relatedChanges: string[]
      diff: {
        files: number
        insertions: number
        deletions: number
      }
    }>
  }
  /** OpenSpecUI runtime config captured during export */
  config?: OpenSpecUIConfig
  /** All specs with parsed content (compound identity is source-aware). */
  specs: Array<{
    /** Compound identity: owned specs use `(owned, specId)`; referenced specs use `(referenced, storeId, specId)`. */
    identity: SpecIdentity
    /** Whether this Spec came from the writable root (`owned`) or a read-only direct Reference (`referenced`). */
    source: 'owned' | 'referenced'
    /** Referenced Specs are read-only; owned Specs are writable. */
    readOnly: boolean
    /** Store id that owns this Spec when `source === 'referenced'`; absent for owned Specs. */
    storeId?: string
    id: string
    name: string
    /** Processed markdown shown by default in static OpenSpecUI. */
    content: string
    /** Original source markdown, preserved for raw/source views. */
    sourceContent?: string
    overview: string
    requirements: Array<{
      id: string
      title: string
      bodyMarkdown: string
      text: string
      scenarios: Array<{
        title: string
        bodyMarkdown: string
        rawText: string
        steps?: Array<{
          keyword: 'GIVEN' | 'WHEN' | 'THEN' | 'AND' | 'BUT'
          contentMarkdown: string
          rawText: string
        }>
      }>
    }>
    createdAt: number
    updatedAt: number
  }>
  /** All active changes with parsed content */
  changes: Array<{
    id: string
    name: string
    /** Processed proposal markdown shown by default in static OpenSpecUI. */
    proposal: string
    /** Original source proposal markdown. */
    sourceProposal?: string
    tasks?: string
    sourceTasks?: string
    design?: string
    sourceDesign?: string
    why: string
    whatChanges: string
    /** Formal workflow task truth from the tracked artifact glob. */
    trackedTaskProgress: TrackedTaskProgress
    /** Secondary schema-document checkbox analytics. */
    documentChecklistSummary: DocumentChecklistSummary
    deltas: Array<{
      capability: string
      /** Processed delta spec markdown. */
      content: string
      /** Original source delta spec markdown. */
      sourceContent?: string
    }>
    createdAt: number
    updatedAt: number
  }>
  /** All archived changes */
  archives: Array<{
    id: string
    name: string
    /** Schema-neutral archived entity detail used by archive views, search, and dashboard facts. */
    entity: OpsxEntityDetail
    trackedTaskProgress: TrackedTaskProgress
    documentChecklistSummary: DocumentChecklistSummary
    createdAt: number
    updatedAt: number
  }>
  /** Project.md content */
  projectMd?: string
  /** OPSX configuration data (for Config view) */
  opsx?: {
    configYaml?: string
    schemas: SchemaInfo[]
    schemaDetails: Record<string, SchemaDetail>
    schemaYamls?: Record<string, string>
    schemaResolutions: Record<string, SchemaResolution>
    templates: Record<string, TemplatesMap>
    templateContents?: Record<
      string,
      Record<
        string,
        {
          content: string | null
          /** Display-safe relative path; absolute paths are redacted before publication. */
          path: string
          displayPath?: string
          source: 'project' | 'user' | 'package'
        }
      >
    >
    changeMetadata: Record<string, string | null>
  }
}
