/**
 * Static Data Provider
 *
 * Provides data from the static snapshot (data.json) instead of WebSocket subscriptions
 *
 * The snapshot includes fully parsed markdown content generated during export,
 * so specs, changes, and archives can be displayed with proper rendering.
 */

import type {
  ArchiveMeta,
  Change,
  ChangeFile,
  ChangeMeta,
  ChangeStatus,
  DashboardCardAvailability,
  DashboardMetricKey,
  DashboardOverview,
  DashboardTrendKind,
  DashboardTrendPoint,
  DashboardTriColorTrendPoint,
  OpenSpecUIConfig,
  SchemaArtifact,
  SchemaDetail,
  SchemaInfo,
  SchemaResolution,
  Spec,
  SpecMeta,
  TemplatesMap,
} from '@openspecui/core'
import type { SearchDocument } from '@openspecui/search'
import { parse as parseYaml } from 'yaml'
import type { ExportSnapshot } from '../ssg/types'
import { getBasePath, getInitialData } from './static-mode'

/**
 * In-memory cache of the loaded snapshot
 */
let snapshotCache: ExportSnapshot | null = null
let snapshotPromise: Promise<ExportSnapshot | null> | null = null

const DASHBOARD_METRIC_KEYS: DashboardMetricKey[] = [
  'specifications',
  'requirements',
  'activeChanges',
  'inProgressChanges',
  'completedChanges',
  'taskCompletionPercent',
]
const DASHBOARD_TREND_POINT_LIMIT = 100
const DASHBOARD_TREND_BAR_COUNT = 20
const DAY_MS = 24 * 60 * 60 * 1000

interface TrendEvent {
  ts: number
  value: number
}

function createEmptyTrends(): Record<DashboardMetricKey, DashboardTrendPoint[]> {
  const trends = {} as Record<DashboardMetricKey, DashboardTrendPoint[]>
  for (const metric of DASHBOARD_METRIC_KEYS) {
    trends[metric] = []
  }
  return trends
}

function createEmptyTriColorTrends(): Record<DashboardMetricKey, DashboardTriColorTrendPoint[]> {
  const trends = {} as Record<DashboardMetricKey, DashboardTriColorTrendPoint[]>
  for (const metric of DASHBOARD_METRIC_KEYS) {
    trends[metric] = []
  }
  return trends
}

function createCardAvailability(
  taskCompletionPercent: number | null,
  options: {
    hasObjectiveSpecificationTrend: boolean
    hasObjectiveRequirementTrend: boolean
    hasObjectiveCompletedTrend: boolean
  }
): Record<DashboardMetricKey, DashboardCardAvailability> {
  return {
    specifications: options.hasObjectiveSpecificationTrend
      ? { state: 'ok' }
      : { state: 'invalid', reason: 'objective-history-unavailable' },
    requirements: options.hasObjectiveRequirementTrend
      ? { state: 'ok' }
      : { state: 'invalid', reason: 'objective-history-unavailable' },
    activeChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
    inProgressChanges: { state: 'invalid', reason: 'objective-history-unavailable' },
    completedChanges: options.hasObjectiveCompletedTrend
      ? { state: 'ok' }
      : { state: 'invalid', reason: 'objective-history-unavailable' },
    taskCompletionPercent: {
      state: 'invalid',
      reason:
        taskCompletionPercent === null ? 'semantic-uncomputable' : 'objective-history-unavailable',
    },
  }
}

function createTrendKinds(): Record<DashboardMetricKey, DashboardTrendKind> {
  return {
    specifications: 'monotonic',
    requirements: 'monotonic',
    activeChanges: 'bidirectional',
    inProgressChanges: 'bidirectional',
    completedChanges: 'monotonic',
    taskCompletionPercent: 'bidirectional',
  }
}

function resolveTrendTimestamp(
  primary: number | undefined,
  secondary: number | undefined
): number | null {
  if (typeof primary === 'number' && Number.isFinite(primary) && primary > 0) return primary
  if (typeof secondary === 'number' && Number.isFinite(secondary) && secondary > 0) return secondary
  return null
}

function parseDatedIdTimestamp(id: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:-|$)/.exec(id)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12) return null
  if (day < 1 || day > 31) return null
  const ts = Date.UTC(year, month - 1, day)
  return Number.isFinite(ts) ? ts : null
}

function normalizeTrendEvents(events: TrendEvent[], pointLimit: number): TrendEvent[] {
  return events
    .filter((event) => Number.isFinite(event.ts) && event.ts > 0 && Number.isFinite(event.value))
    .sort((a, b) => a.ts - b.ts)
    .slice(-pointLimit)
}

function buildBucketedTrend(
  events: TrendEvent[],
  pointLimit: number,
  mode: 'sum' | 'sum-cumulative'
): DashboardTrendPoint[] {
  const normalizedEvents = normalizeTrendEvents(events, pointLimit)
  if (normalizedEvents.length === 0) {
    return []
  }

  const end = normalizedEvents[normalizedEvents.length - 1]!.ts
  const probeStart = normalizedEvents[0]!.ts
  const rangeMs = Math.max(1, end - probeStart)
  const bucketMs =
    rangeMs >= DAY_MS
      ? Math.max(DAY_MS, Math.ceil(rangeMs / DASHBOARD_TREND_BAR_COUNT / DAY_MS) * DAY_MS)
      : Math.max(1, Math.ceil(rangeMs / DASHBOARD_TREND_BAR_COUNT))
  const windowStart = end - bucketMs * DASHBOARD_TREND_BAR_COUNT

  const bucketEnds = Array.from(
    { length: DASHBOARD_TREND_BAR_COUNT },
    (_, index) => windowStart + bucketMs * (index + 1)
  )
  const sums = Array.from({ length: bucketEnds.length }, () => 0)
  let baseline = 0

  for (const event of normalizedEvents) {
    if (event.ts <= windowStart) {
      if (mode === 'sum-cumulative') {
        baseline += event.value
      }
      continue
    }

    const offset = event.ts - windowStart
    const index = Math.max(0, Math.min(bucketEnds.length - 1, Math.ceil(offset / bucketMs) - 1))
    sums[index] += event.value
  }

  let cumulative = baseline
  return bucketEnds.map((ts, index) => {
    if (mode === 'sum-cumulative') {
      cumulative += sums[index]
      return { ts, value: cumulative }
    }
    return { ts, value: sums[index] }
  })
}

function buildStaticObjectiveTrends(snapshot: ExportSnapshot): DashboardOverview['trends'] {
  const trends = createEmptyTrends()
  const requirementEvents = snapshot.specs.flatMap((spec) => {
    const ts = resolveTrendTimestamp(spec.updatedAt, spec.createdAt)
    return ts === null ? [] : [{ ts, value: spec.requirements.length }]
  })

  trends.specifications = buildBucketedTrend(
    snapshot.specs.flatMap((spec) => {
      const ts = resolveTrendTimestamp(spec.createdAt, spec.updatedAt)
      return ts === null ? [] : [{ ts, value: 1 }]
    }),
    DASHBOARD_TREND_POINT_LIMIT,
    'sum'
  )

  trends.requirements = buildBucketedTrend(requirementEvents, DASHBOARD_TREND_POINT_LIMIT, 'sum')

  trends.completedChanges = buildBucketedTrend(
    snapshot.archives.flatMap((archive) => {
      const ts =
        parseDatedIdTimestamp(archive.id) ??
        resolveTrendTimestamp(archive.updatedAt, archive.createdAt)
      return ts === null ? [] : [{ ts, value: archive.parsedTasks.length }]
    }),
    DASHBOARD_TREND_POINT_LIMIT,
    'sum'
  )

  return trends
}

interface GlobArtifactFile {
  path: string
  type: 'file'
  content: string
}

function isGlobPattern(path: string): boolean {
  return path.includes('*') || path.includes('?') || path.includes('[')
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function getPathBasename(path: string): string {
  const normalized = normalizePath(path)
  const parts = normalized.split('/')
  return parts[parts.length - 1] ?? normalized
}

function escapeRegexChar(char: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char
}

function globToRegex(pattern: string): RegExp {
  const normalized = normalizePath(pattern)
  let source = '^'

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i]

    if (char === '*') {
      if (normalized[i + 1] === '*') {
        i += 1
        if (normalized[i + 1] === '/') {
          i += 1
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
      continue
    }

    if (char === '?') {
      source += '[^/]'
      continue
    }

    if (char === '[') {
      const closeIndex = normalized.indexOf(']', i + 1)
      if (closeIndex > i + 1) {
        source += normalized.slice(i, closeIndex + 1)
        i = closeIndex
        continue
      }
    }

    source += escapeRegexChar(char)
  }

  source += '$'
  return new RegExp(source)
}

function matchesGlob(path: string, pattern: string): boolean {
  return globToRegex(pattern).test(normalizePath(path))
}

function hasContent(content: string | undefined | null): boolean {
  return typeof content === 'string' && content.trim().length > 0
}

function getSnapshotChangeFiles(change: ExportSnapshot['changes'][number]): Record<string, string> {
  const files: Record<string, string> = {}

  if (hasContent(change.proposal)) files['proposal.md'] = change.proposal
  if (hasContent(change.tasks)) files['tasks.md'] = change.tasks ?? ''
  if (hasContent(change.design)) files['design.md'] = change.design ?? ''

  for (const delta of change.deltas) {
    const path = `specs/${delta.capability}/spec.md`
    if (hasContent(delta.content)) files[path] = delta.content
  }

  return files
}

function resolveMetadataSchema(snapshot: ExportSnapshot, changeId: string): string | undefined {
  const metadata = snapshot.opsx?.changeMetadata?.[changeId]
  if (!metadata) return undefined
  try {
    const parsed = parseYaml(metadata) as Record<string, unknown> | null
    if (typeof parsed?.schema === 'string' && parsed.schema.length > 0) {
      return parsed.schema
    }
  } catch {
    return undefined
  }
  return undefined
}

function resolveSchemaName(
  snapshot: ExportSnapshot,
  changeId: string,
  preferredSchema?: string
): string {
  const detailMap = snapshot.opsx?.schemaDetails ?? {}

  if (preferredSchema && detailMap[preferredSchema]) {
    return preferredSchema
  }

  const metadataSchema = resolveMetadataSchema(snapshot, changeId)
  if (metadataSchema && detailMap[metadataSchema]) {
    return metadataSchema
  }

  const firstSchema = snapshot.opsx?.schemas?.[0]?.name
  if (firstSchema) return firstSchema

  const firstDetail = Object.keys(detailMap)[0]
  if (firstDetail) return firstDetail

  return preferredSchema ?? 'spec-driven'
}

function fallbackSchemaArtifacts(): SchemaArtifact[] {
  return [
    { id: 'proposal', outputPath: 'proposal.md', requires: [] },
    { id: 'tasks', outputPath: 'tasks.md', requires: [] },
    { id: 'design', outputPath: 'design.md', requires: [] },
    { id: 'specs', outputPath: 'specs/**/*.md', requires: [] },
  ]
}

function resolveSchemaDetail(snapshot: ExportSnapshot, schemaName: string): SchemaDetail {
  const schemaDetail = snapshot.opsx?.schemaDetails?.[schemaName]
  if (schemaDetail) return schemaDetail

  return {
    name: schemaName,
    artifacts: fallbackSchemaArtifacts(),
    applyRequires: [],
  }
}

function resolveArtifactOutput(
  change: ExportSnapshot['changes'][number],
  outputPath: string,
  artifactId?: string
): string | null {
  const files = getSnapshotChangeFiles(change)
  const normalizedOutputPath = normalizePath(outputPath)
  const directMatch = files[normalizedOutputPath]
  if (hasContent(directMatch)) return directMatch

  const basename = getPathBasename(normalizedOutputPath)
  if (basename === 'proposal.md' && hasContent(change.proposal)) return change.proposal
  if (basename === 'tasks.md' && hasContent(change.tasks)) return change.tasks ?? null
  if (basename === 'design.md' && hasContent(change.design)) return change.design ?? null

  if (artifactId === 'proposal' && hasContent(change.proposal)) return change.proposal
  if (artifactId === 'tasks' && hasContent(change.tasks)) return change.tasks ?? null
  if (artifactId === 'design' && hasContent(change.design)) return change.design ?? null

  return null
}

function resolveGlobArtifactFiles(
  change: ExportSnapshot['changes'][number],
  outputPath: string
): GlobArtifactFile[] {
  const files = getSnapshotChangeFiles(change)
  const pattern = normalizePath(outputPath)

  return Object.entries(files)
    .filter(([path]) => matchesGlob(path, pattern))
    .map(([path, content]) => ({ path, type: 'file', content }))
}

function buildChangeStatus(
  snapshot: ExportSnapshot,
  change: ExportSnapshot['changes'][number],
  preferredSchema?: string
): ChangeStatus {
  const schemaName = resolveSchemaName(snapshot, change.id, preferredSchema)
  const schemaDetail = resolveSchemaDetail(snapshot, schemaName)

  const doneById = new Map<string, boolean>()
  for (const artifact of schemaDetail.artifacts) {
    const done = isGlobPattern(artifact.outputPath)
      ? resolveGlobArtifactFiles(change, artifact.outputPath).length > 0
      : hasContent(resolveArtifactOutput(change, artifact.outputPath, artifact.id))
    doneById.set(artifact.id, done)
  }

  const artifacts = schemaDetail.artifacts.map((artifact) => {
    const done = doneById.get(artifact.id) === true
    if (done) {
      return {
        id: artifact.id,
        outputPath: artifact.outputPath,
        status: 'done' as const,
        relativePath: `openspec/changes/${change.id}/${artifact.outputPath}`,
      }
    }

    const missingDeps = artifact.requires.filter((dep) => doneById.get(dep) !== true)
    return {
      id: artifact.id,
      outputPath: artifact.outputPath,
      status: missingDeps.length > 0 ? ('blocked' as const) : ('ready' as const),
      missingDeps: missingDeps.length > 0 ? missingDeps : undefined,
      relativePath: `openspec/changes/${change.id}/${artifact.outputPath}`,
    }
  })

  return {
    changeName: change.id,
    schemaName,
    isComplete: artifacts.every((artifact) => artifact.status === 'done'),
    applyRequires: schemaDetail.applyRequires ?? [],
    artifacts,
  }
}

/**
 * Load the static snapshot once
 */
export async function loadSnapshot(): Promise<ExportSnapshot | null> {
  // Return cached data if available
  if (snapshotCache) {
    return snapshotCache
  }

  // Check for injected initial data first (SSR/SSG)
  const initialData = getInitialData()
  if (initialData) {
    snapshotCache = initialData
    return initialData
  }

  // Reuse in-flight request if exists
  if (snapshotPromise) {
    return snapshotPromise
  }

  snapshotPromise = (async () => {
    try {
      const basePath = getBasePath()
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
 * Get objective dashboard overview data from static snapshot.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const snapshot = await loadSnapshot()
  if (!snapshot) {
    const taskCompletionPercent = null
    return {
      summary: {
        specifications: 0,
        requirements: 0,
        activeChanges: 0,
        inProgressChanges: 0,
        completedChanges: 0,
        archivedTasksCompleted: 0,
        tasksTotal: 0,
        tasksCompleted: 0,
        taskCompletionPercent,
      },
      trends: createEmptyTrends(),
      triColorTrends: createEmptyTriColorTrends(),
      trendKinds: createTrendKinds(),
      cardAvailability: createCardAvailability(taskCompletionPercent, {
        hasObjectiveSpecificationTrend: true,
        hasObjectiveRequirementTrend: true,
        hasObjectiveCompletedTrend: true,
      }),
      trendMeta: {
        pointLimit: DASHBOARD_TREND_POINT_LIMIT,
        lastUpdatedAt: Date.now(),
      },
      specifications: [],
      activeChanges: [],
      git: {
        defaultBranch: 'main',
        worktrees: [],
      },
    }
  }

  const specifications = snapshot.specs
    .map((spec) => ({
      id: spec.id,
      name: spec.name,
      requirements: spec.requirements.length,
      updatedAt: spec.updatedAt,
    }))
    .sort((a, b) => b.requirements - a.requirements || b.updatedAt - a.updatedAt)

  const activeChanges = snapshot.changes
    .map((change) => ({
      id: change.id,
      name: change.name,
      progress: change.progress,
      updatedAt: change.updatedAt,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  const requirements = specifications.reduce((sum, spec) => sum + spec.requirements, 0)
  const tasksTotal = activeChanges.reduce((sum, change) => sum + change.progress.total, 0)
  const tasksCompleted = activeChanges.reduce((sum, change) => sum + change.progress.completed, 0)
  const archivedTasksCompleted = snapshot.archives.reduce(
    (sum, archive) => sum + archive.parsedTasks.length,
    0
  )
  const taskCompletionPercent =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : null
  const inProgressChanges = activeChanges.filter(
    (change) => change.progress.total > 0 && change.progress.completed < change.progress.total
  ).length

  const trends = buildStaticObjectiveTrends(snapshot)
  const hasObjectiveSpecificationTrend =
    trends.specifications.length > 0 || specifications.length === 0
  const hasObjectiveRequirementTrend = trends.requirements.length > 0 || requirements === 0
  const hasObjectiveCompletedTrend =
    trends.completedChanges.length > 0 || snapshot.archives.length === 0

  return {
    summary: {
      specifications: specifications.length,
      requirements,
      activeChanges: activeChanges.length,
      inProgressChanges,
      completedChanges: snapshot.archives.length,
      archivedTasksCompleted,
      tasksTotal,
      tasksCompleted,
      taskCompletionPercent,
    },
    trends,
    triColorTrends: createEmptyTriColorTrends(),
    trendKinds: createTrendKinds(),
    cardAvailability: createCardAvailability(taskCompletionPercent, {
      hasObjectiveSpecificationTrend,
      hasObjectiveRequirementTrend,
      hasObjectiveCompletedTrend,
    }),
    trendMeta: {
      pointLimit: DASHBOARD_TREND_POINT_LIMIT,
      lastUpdatedAt: Date.now(),
    },
    specifications,
    activeChanges,
    git: {
      defaultBranch: 'main',
      worktrees: [],
    },
  }
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
 * Get UI config (default in static mode)
 */
export async function getConfig(): Promise<OpenSpecUIConfig> {
  const snapshot = await loadSnapshot()
  const defaultConfig: OpenSpecUIConfig = {
    cli: { command: 'openspecui' },
    theme: 'system',
    dashboard: {
      trendPointLimit: 100,
    },
    terminal: {
      fontSize: 13,
      fontFamily: '',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      rendererEngine: 'xterm',
    },
  }

  const fromSnapshot = snapshot?.config
  if (!fromSnapshot) {
    return defaultConfig
  }

  return {
    ...defaultConfig,
    ...fromSnapshot,
    cli: {
      ...defaultConfig.cli,
      ...fromSnapshot.cli,
    },
    terminal: {
      ...defaultConfig.terminal,
      ...fromSnapshot.terminal,
    },
    dashboard: {
      ...defaultConfig.dashboard,
      ...fromSnapshot.dashboard,
    },
  }
}

/**
 * Get configured tools (empty in static mode)
 */
export async function getConfiguredTools(): Promise<string[]> {
  return []
}

// =====================
// OPSX Config data (static mode)
// =====================

export async function getOpsxProjectConfig(): Promise<string | null> {
  const snapshot = await loadSnapshot()
  return snapshot?.opsx?.configYaml ?? null
}

export async function getOpsxSchemas(): Promise<SchemaInfo[]> {
  const snapshot = await loadSnapshot()
  return snapshot?.opsx?.schemas ?? []
}

export async function getOpsxConfigBundle(): Promise<{
  schemas: SchemaInfo[]
  schemaDetails: Record<string, SchemaDetail | null>
  schemaResolutions: Record<string, SchemaResolution | null>
}> {
  const snapshot = await loadSnapshot()
  return {
    schemas: snapshot?.opsx?.schemas ?? [],
    schemaDetails: snapshot?.opsx?.schemaDetails ?? {},
    schemaResolutions: snapshot?.opsx?.schemaResolutions ?? {},
  }
}

export async function getOpsxSchemaDetail(name?: string): Promise<SchemaDetail | null> {
  if (!name) return null
  const snapshot = await loadSnapshot()
  const details = snapshot?.opsx?.schemaDetails
  return details?.[name] ?? null
}

export async function getOpsxSchemaResolution(name?: string): Promise<SchemaResolution | null> {
  if (!name) return null
  const snapshot = await loadSnapshot()
  const resolutions = snapshot?.opsx?.schemaResolutions
  return resolutions?.[name] ?? null
}

export async function getOpsxTemplates(schema?: string): Promise<TemplatesMap | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot?.opsx?.templates) return null
  if (!schema) {
    const first = Object.keys(snapshot.opsx.templates)[0]
    return first ? snapshot.opsx.templates[first] : null
  }
  return snapshot.opsx.templates[schema] ?? null
}

export async function getOpsxSchemaFiles(name?: string): Promise<ChangeFile[] | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot?.opsx) return null

  let schemaName = name
  if (!schemaName) {
    schemaName =
      snapshot.opsx.schemas?.[0]?.name ?? Object.keys(snapshot.opsx.schemaDetails ?? {})[0]
  }
  if (!schemaName) return null

  const entries: ChangeFile[] = []
  const seen = new Set<string>()

  const addEntry = (entry: ChangeFile) => {
    if (seen.has(entry.path)) return
    seen.add(entry.path)
    entries.push(entry)
  }

  const addDirEntries = (path: string) => {
    const parts = path.split('/')
    for (let i = 1; i < parts.length; i++) {
      const dirPath = parts.slice(0, i).join('/')
      if (dirPath) addEntry({ path: dirPath, type: 'directory' })
    }
  }

  if (snapshot.opsx.schemaDetails?.[schemaName]) {
    addEntry({ path: 'schema.yaml', type: 'file' })
  }

  const templates = snapshot.opsx.templates?.[schemaName]
  if (templates) {
    Object.values(templates).forEach((template) => {
      addDirEntries(template.path)
      addEntry({ path: template.path, type: 'file' })
    })
  }

  return entries
}

export async function getOpsxSchemaYaml(_name?: string): Promise<string | null> {
  return null
}

export async function getOpsxTemplateContent(
  _schema?: string,
  _artifactId?: string
): Promise<{
  content: string | null
  path: string
  source: 'project' | 'user' | 'package'
} | null> {
  return null
}

export async function getOpsxTemplateContents(): Promise<Record<
  string,
  { content: string | null; path: string; source: 'project' | 'user' | 'package' }
> | null> {
  return null
}

export async function getOpsxChangeList(): Promise<string[]> {
  const snapshot = await loadSnapshot()
  if (snapshot?.opsx?.changeMetadata) {
    return Object.keys(snapshot.opsx.changeMetadata)
  }
  return snapshot?.changes.map((change) => change.id) ?? []
}

export async function getOpsxChangeMetadata(changeId?: string): Promise<string | null> {
  if (!changeId) return null
  const snapshot = await loadSnapshot()
  const meta = snapshot?.opsx?.changeMetadata
  if (meta && changeId in meta) {
    return meta[changeId] ?? null
  }
  return null
}

export async function getOpsxStatus(
  changeId?: string,
  schema?: string
): Promise<ChangeStatus | null> {
  if (!changeId) return null
  const snapshot = await loadSnapshot()
  if (!snapshot) return null
  const change = snapshot.changes.find((item) => item.id === changeId)
  if (!change) return null
  return buildChangeStatus(snapshot, change, schema)
}

export async function getOpsxStatusList(): Promise<ChangeStatus[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []
  return snapshot.changes.map((change) => buildChangeStatus(snapshot, change))
}

export async function getOpsxArtifactOutput(
  changeId?: string,
  outputPath?: string
): Promise<string | null> {
  if (!changeId || !outputPath) return null
  if (isGlobPattern(outputPath)) return null

  const snapshot = await loadSnapshot()
  if (!snapshot) return null
  const change = snapshot.changes.find((item) => item.id === changeId)
  if (!change) return null

  return resolveArtifactOutput(change, outputPath)
}

export async function getOpsxGlobArtifactFiles(
  changeId?: string,
  outputPath?: string
): Promise<GlobArtifactFile[]> {
  if (!changeId || !outputPath) return []
  if (!isGlobPattern(outputPath)) return []

  const snapshot = await loadSnapshot()
  if (!snapshot) return []
  const change = snapshot.changes.find((item) => item.id === changeId)
  if (!change) return []

  return resolveGlobArtifactFiles(change, outputPath)
}

export async function getSearchDocuments(): Promise<SearchDocument[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  const docs: SearchDocument[] = []

  for (const spec of snapshot.specs) {
    docs.push({
      id: `spec:${spec.id}`,
      kind: 'spec',
      title: spec.name,
      href: `/specs/${encodeURIComponent(spec.id)}`,
      path: `openspec/specs/${spec.id}/spec.md`,
      content: spec.content,
      updatedAt: spec.updatedAt,
    })
  }

  for (const change of snapshot.changes) {
    docs.push({
      id: `change:${change.id}`,
      kind: 'change',
      title: change.name,
      href: `/changes/${encodeURIComponent(change.id)}`,
      path: `openspec/changes/${change.id}`,
      content: [
        change.proposal,
        change.tasks,
        change.design,
        ...change.deltas.map((delta) => delta.content),
      ]
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length > 0)
        .join('\n\n'),
      updatedAt: change.updatedAt,
    })
  }

  for (const archive of snapshot.archives) {
    docs.push({
      id: `archive:${archive.id}`,
      kind: 'archive',
      title: archive.name,
      href: `/archive/${encodeURIComponent(archive.id)}`,
      path: `openspec/changes/archive/${archive.id}`,
      content: [archive.proposal, archive.tasks, archive.design]
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length > 0)
        .join('\n\n'),
      updatedAt: archive.updatedAt,
    })
  }

  return docs
}
