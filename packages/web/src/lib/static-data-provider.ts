/**
 * Static Data Provider
 *
 * Provides data from the static snapshot (data.json) instead of WebSocket subscriptions
 *
 * The snapshot includes fully parsed markdown content generated during export,
 * so specs, changes, and archives can be displayed with proper rendering.
 */

import type { ArchiveMeta, Change, ChangeFile, ChangeMeta, Spec, SpecMeta } from '@openspecui/core'
import type { ExportSnapshot } from '../../../cli/src/export'
import type { ChangeRaw, DashboardData, OpenSpecUIConfig } from './use-subscription'

/**
 * In-memory cache of the loaded snapshot
 */
let snapshotCache: ExportSnapshot | null = null
let snapshotPromise: Promise<ExportSnapshot | null> | null = null

/**
 * Load the static snapshot once
 */
export async function loadSnapshot(): Promise<ExportSnapshot | null> {
  // Return cached data if available
  if (snapshotCache) {
    return snapshotCache
  }

  // Reuse in-flight request if exists
  if (snapshotPromise) {
    return snapshotPromise
  }

  snapshotPromise = (async () => {
    try {
      const basePath = window.__OPENSPEC_BASE_PATH__ || '/'
      const dataUrl = `${basePath}data.json`.replace('//', '/')
      const response = await fetch(dataUrl)

      if (!response.ok) {
        console.error('Failed to load data snapshot:', response.statusText)
        return null
      }

      const snapshot = (await response.json()) as ExportSnapshot
      snapshotCache = snapshot
      return snapshot
    } catch (error) {
      console.error('Error loading static snapshot:', error)
      return null
    }
  })()

  return snapshotPromise
}

/**
 * Convert snapshot spec to Spec type (with parsed content from export)
 */
function snapshotSpecToSpec(snapSpec: ExportSnapshot['specs'][0]): Spec {
  return {
    id: snapSpec.id,
    name: snapSpec.name,
    overview: snapSpec.overview,
    requirements: snapSpec.requirements,
    metadata: {
      version: '1.0',
      format: 'openspec' as const,
    },
  }
}

/**
 * Convert snapshot change to Change type (with parsed content from export)
 */
function snapshotChangeToChange(snapChange: ExportSnapshot['changes'][0]): Change {
  return {
    id: snapChange.id,
    name: snapChange.name,
    why: snapChange.why,
    whatChanges: snapChange.whatChanges,
    design: snapChange.design,
    deltas: [], // Simplified - not used in UI directly
    tasks: snapChange.parsedTasks,
    progress: snapChange.progress,
  } as Change
}

/**
 * Get dashboard data from snapshot
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const specs = snapshot.specs.map(snapshotSpecToSpec)
  const changes = snapshot.changes.map(snapshotChangeToChange)
  const archives = snapshot.archives

  // Calculate summary
  const specCount = specs.length
  const requirementCount = 0 // Simplified for static mode
  const activeChangeCount = changes.length
  const archivedChangeCount = archives.length

  // Calculate task progress from snapshot data
  let totalTasks = 0
  let completedTasks = 0

  for (const change of snapshot.changes) {
    totalTasks += change.progress.total
    completedTasks += change.progress.completed
  }

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return {
    specs,
    changes,
    archivedCount: archivedChangeCount,
    summary: {
      specCount,
      requirementCount,
      activeChangeCount,
      archivedChangeCount,
      totalTasks,
      completedTasks,
      progressPercent,
    },
  }
}

/**
 * Check if OpenSpec is initialized (always true in static mode)
 */
export async function getInitialized(): Promise<boolean> {
  const snapshot = await loadSnapshot()
  return snapshot !== null
}

/**
 * Get all specs metadata
 */
export async function getSpecs(): Promise<SpecMeta[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  return snapshot.specs.map((spec) => ({
    id: spec.id,
    name: spec.name,
    createdAt: spec.createdAt,
    updatedAt: spec.updatedAt,
  }))
}

/**
 * Get a single spec by ID
 */
export async function getSpec(id: string): Promise<Spec | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const snapSpec = snapshot.specs.find((s) => s.id === id)
  if (!snapSpec) return null

  return snapshotSpecToSpec(snapSpec)
}

/**
 * Get raw spec content (markdown)
 */
export async function getSpecRaw(id: string): Promise<string | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const spec = snapshot.specs.find((s) => s.id === id)
  return spec?.content || null
}

/**
 * Get all changes metadata
 */
export async function getChanges(): Promise<ChangeMeta[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  return snapshot.changes.map((change) => ({
    id: change.id,
    name: change.name,
    progress: change.progress,
    createdAt: change.createdAt,
    updatedAt: change.updatedAt,
  }))
}

/**
 * Get a single change by ID
 */
export async function getChange(id: string): Promise<Change | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const snapChange = snapshot.changes.find((c) => c.id === id)
  if (!snapChange) return null

  return snapshotChangeToChange(snapChange)
}

/**
 * Get change files
 */
export async function getChangeFiles(id: string): Promise<ChangeFile[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  const change = snapshot.changes.find((c) => c.id === id)
  if (!change) return []

  const files: ChangeFile[] = []

  files.push({
    path: 'proposal.md',
    type: 'file' as const,
    content: change.proposal,
  })

  if (change.tasks) {
    files.push({
      path: 'tasks.md',
      type: 'file' as const,
      content: change.tasks,
    })
  }

  if (change.design) {
    files.push({
      path: 'design.md',
      type: 'file' as const,
      content: change.design,
    })
  }

  // Add delta spec files
  change.deltas.forEach((delta) => {
    files.push({
      path: `specs/${delta.capability}/spec.md`,
      type: 'file' as const,
      content: delta.content,
    })
  })

  return files
}

/**
 * Get raw change content
 */
export async function getChangeRaw(id: string): Promise<ChangeRaw | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const change = snapshot.changes.find((c) => c.id === id)
  if (!change) return null

  return {
    proposal: change.proposal,
    tasks: change.tasks,
  }
}

/**
 * Get all archives metadata
 */
export async function getArchives(): Promise<ArchiveMeta[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  return snapshot.archives.map((archive) => ({
    id: archive.id,
    name: archive.name,
    createdAt: archive.createdAt,
    updatedAt: archive.updatedAt,
  }))
}

/**
 * Get a single archive by ID
 */
export async function getArchive(id: string): Promise<Change | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const snapArchive = snapshot.archives.find((a) => a.id === id)
  if (!snapArchive) return null

  // Convert archive to Change with parsed content
  return {
    id: snapArchive.id,
    name: snapArchive.name,
    why: snapArchive.why,
    whatChanges: snapArchive.whatChanges,
    design: snapArchive.design,
    deltas: [],
    tasks: snapArchive.parsedTasks,
    progress: { total: 0, completed: 0 },
  } as Change
}

/**
 * Get archive files
 */
export async function getArchiveFiles(id: string): Promise<ChangeFile[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  const archive = snapshot.archives.find((a) => a.id === id)
  if (!archive) return []

  const files: ChangeFile[] = []

  files.push({
    path: 'proposal.md',
    type: 'file' as const,
    content: archive.proposal,
  })

  if (archive.tasks) {
    files.push({
      path: 'tasks.md',
      type: 'file' as const,
      content: archive.tasks,
    })
  }

  if (archive.design) {
    files.push({
      path: 'design.md',
      type: 'file' as const,
      content: archive.design,
    })
  }

  return files
}

/**
 * Get project.md content (not in snapshot currently)
 */
export async function getProjectMd(): Promise<string | null> {
  const snapshot = await loadSnapshot()
  return snapshot?.projectMd || null
}

/**
 * Get AGENTS.md content (not in snapshot currently)
 */
export async function getAgentsMd(): Promise<string | null> {
  const snapshot = await loadSnapshot()
  return snapshot?.agentsMd || null
}

/**
 * Get UI config (default in static mode)
 */
export async function getConfig(): Promise<OpenSpecUIConfig> {
  // In static mode, return default config
  return {
    cli: { command: 'openspecui' },
    ui: { theme: 'system' },
  }
}

/**
 * Get configured tools (empty in static mode)
 */
export async function getConfiguredTools(): Promise<string[]> {
  return []
}
