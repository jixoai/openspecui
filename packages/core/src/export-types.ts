/**
 * Types for static export / SSG
 */
import type {
  SchemaDetail,
  SchemaInfo,
  SchemaResolution,
  TemplatesMap,
} from './opsx-types.js'

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
    schemaResolutions: Record<string, SchemaResolution>
    templates: Record<string, TemplatesMap>
    changeMetadata: Record<string, string | null>
  }
}
