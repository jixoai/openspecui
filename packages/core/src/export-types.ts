/**
 * Types for static export / SSG
 */
import type { OpenSpecUIConfig } from './config.js'
import type { SchemaDetail, SchemaInfo, SchemaResolution, TemplatesMap } from './opsx-types.js'

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
    id: string
    name: string
    content: string
    overview: string
    requirements: Array<{
      id: string
      text: string
      scenarios: Array<{ rawText: string }>
    }>
    createdAt: number
    updatedAt: number
  }>
  /** All active changes with parsed content */
  changes: Array<{
    id: string
    name: string
    proposal: string
    tasks?: string
    design?: string
    why: string
    whatChanges: string
    parsedTasks: Array<{
      id: string
      text: string
      completed: boolean
      section?: string
    }>
    deltas: Array<{
      capability: string
      content: string
    }>
    progress: { total: number; completed: number }
    createdAt: number
    updatedAt: number
  }>
  /** All archived changes */
  archives: Array<{
    id: string
    name: string
    proposal: string
    tasks?: string
    design?: string
    why: string
    whatChanges: string
    parsedTasks: Array<{
      id: string
      text: string
      completed: boolean
      section?: string
    }>
    createdAt: number
    updatedAt: number
  }>
  /** Project.md content */
  projectMd?: string
  /** AGENTS.md content */
  agentsMd?: string
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
