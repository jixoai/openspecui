/**
 * Types for static export / SSG
 */
import type { OpenSpecUIConfig } from './config.js'
import type { OpsxEntityDetail } from './opsx-entity.js'
import type { SchemaDetail, SchemaInfo, SchemaResolution, TemplatesMap } from './opsx-types.js'
import type { OwnedSpecIdentity } from './spec-catalog.js'
import type { DocumentChecklistSummary, TrackedTaskProgress } from './task-progress.js'

/**
 * Complete snapshot of an OpenSpec project for static export
 */
export interface ExportSnapshot {
  /** Snapshot metadata */
  meta: {
    timestamp: string
    version: string
    projectDir: string
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
  /** All specs with parsed content */
  specs: Array<{
    /** Compound identity remains source-aware even before Reference export is enabled. */
    identity: OwnedSpecIdentity
    source: 'owned'
    readOnly: false
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
          path: string
          displayPath?: string
          source: 'project' | 'user' | 'package'
        }
      >
    >
    changeMetadata: Record<string, string | null>
  }
}
