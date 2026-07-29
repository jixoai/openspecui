/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Project one immutable export snapshot through the live provider-shaped API.
 * 2. Preserve compound Spec identity and published snapshot policy/provenance without invented CLI evidence.
 * 3. Reconstruct Dashboard, objective Kanban, workflow, schema, template, and entity reads without a backend.
 * 4. Keep unsupported live mutations and provenance explicitly absent in static mode.
 * 5. Keep static Git snapshots ineligible for live backend binding authority.
 *
 * Original request (2026-07-15): "这是额外的工作还是可以和 live 版本保持尽可能的一致？"
 * Original request (2026-07-15): "Referenced Specs are navigable and searchable but visibly read-only."
 * Derived requirement (2026-07-18): Checkpoint 6.10 scopes Search to the active root or direct Referenced Specs.
 * Original request (2026-07-28): replace Dashboard Workflow Progress with ReadonlyKanban.
 * Owner correction (2026-07-29): static project config does not publish daemon-owned App location.
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
  OpsxEntityDetail,
  SchemaDetail,
  SchemaInfo,
  SchemaResolution,
  Spec,
  TemplatesMap,
} from '@openspecui/core'
import {
  parseDatedArchiveIdTimestamp,
  resolveArchiveTimestamp,
  selectRecentDashboardArchives,
  selectRecentDashboardItems,
} from '@openspecui/core/dashboard-display'
import { DocumentTranslationConfigSchema } from '@openspecui/core/document-translation'
import { toOpsxDisplayPath } from '@openspecui/core/opsx-display-path'
import { isOpsxGlobPattern, opsxPathMatchesPattern } from '@openspecui/core/opsx-entity'
import { DEFAULT_BELL_SOUND_ID, DEFAULT_NOTIFICATION_SOUND_ID } from '@openspecui/core/sounds'
import {
  createStaticSpecCatalogOwnedProjection,
  createStaticSpecCatalogReferenceProjection,
  createStaticSpecCatalogReferenceSource,
  specIdentityKey,
  specRoutePath,
  type SpecCatalog,
  type SpecCatalogEntry,
  type SpecDocumentProjection,
  type SpecIdentity,
} from '@openspecui/core/spec-catalog'
import type { ProjectSearchDocument } from '@openspecui/search'
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

function normalizeTrendEvents(events: TrendEvent[], pointLimit: number): TrendEvent[] {
  return events
    .filter((event) => Number.isFinite(event.ts) && event.ts > 0 && Number.isFinite(event.value))
    .sort((a, b) => a.ts - b.ts)
    .slice(-pointLimit)
}

function buildTimeWindow(
  probeEvents: TrendEvent[],
  rightEdgeTs?: number | null
): { windowStart: number; bucketMs: number; bucketEnds: number[] } | null {
  if (probeEvents.length === 0) return null

  const probeEnd = probeEvents[probeEvents.length - 1]!.ts
  const hasRightEdge =
    typeof rightEdgeTs === 'number' && Number.isFinite(rightEdgeTs) && rightEdgeTs > 0
  const end = hasRightEdge ? Math.max(probeEnd, rightEdgeTs) : probeEnd
  const probeStart = probeEvents[0]!.ts
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

  return { windowStart, bucketMs, bucketEnds }
}

function buildBucketedTrend(
  events: TrendEvent[],
  pointLimit: number,
  mode: 'sum' | 'sum-cumulative',
  rightEdgeTs?: number | null
): DashboardTrendPoint[] {
  const normalizedEvents = normalizeTrendEvents(events, pointLimit)
  if (normalizedEvents.length === 0) {
    return []
  }

  const timeWindow = buildTimeWindow(normalizedEvents, rightEdgeTs)
  if (!timeWindow) return []
  const { windowStart, bucketMs, bucketEnds } = timeWindow
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

function buildStaticObjectiveTrends(
  snapshot: ExportSnapshot,
  pointLimit: number,
  rightEdgeTs?: number | null
): DashboardOverview['trends'] {
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
    pointLimit,
    'sum',
    rightEdgeTs
  )

  trends.requirements = buildBucketedTrend(requirementEvents, pointLimit, 'sum', rightEdgeTs)

  trends.completedChanges = buildBucketedTrend(
    snapshot.archives.flatMap((archive) => {
      const ts =
        parseDatedArchiveIdTimestamp(archive.id) ??
        resolveTrendTimestamp(archive.updatedAt, archive.createdAt)
      return ts === null ? [] : [{ ts, value: 1 }]
    }),
    pointLimit,
    'sum',
    rightEdgeTs
  )

  return trends
}

interface GlobArtifactFile {
  path: string
  type: 'file'
  content: string
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '')
}

function normalizeFsPath(path: string): string {
  return path.replace(/\\/g, '/')
}

function isAbsoluteFsPath(path: string): boolean {
  return /^(?:[A-Za-z]:\/|\/)/.test(path)
}

function isPathInside(root: string, target: string): boolean {
  const normalizedRoot = normalizeFsPath(root).replace(/\/+$/, '').toLowerCase()
  const normalizedTarget = normalizeFsPath(target).toLowerCase()
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`)
}

function toRelativeFromRoot(root: string, target: string): string {
  const normalizedRoot = normalizeFsPath(root).replace(/\/+$/, '')
  const normalizedTarget = normalizeFsPath(target)
  return normalizedTarget.slice(normalizedRoot.length + 1)
}

function toSchemaRelativePath(inputPath: string, schemaRoot?: string): string {
  const path = normalizeFsPath(inputPath)
  if (!isAbsoluteFsPath(path)) return normalizePath(path)
  if (schemaRoot && isPathInside(schemaRoot, path)) {
    return normalizePath(toRelativeFromRoot(schemaRoot, path))
  }
  const templatesIdx = path.lastIndexOf('/templates/')
  if (templatesIdx >= 0) {
    return normalizePath(path.slice(templatesIdx + 1))
  }
  return getPathBasename(path)
}

function getPathBasename(path: string): string {
  const normalized = normalizePath(path)
  const parts = normalized.split('/')
  return parts[parts.length - 1] ?? normalized
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

  return preferredSchema ?? 'unknown'
}

function resolveSchemaDetail(snapshot: ExportSnapshot, schemaName: string): SchemaDetail {
  const schemaDetail = snapshot.opsx?.schemaDetails?.[schemaName]
  if (schemaDetail) return schemaDetail

  return {
    name: schemaName,
    artifacts: [],
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

  return Object.entries(files)
    .filter(([path]) => opsxPathMatchesPattern(path, outputPath))
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
    const done = isOpsxGlobPattern(artifact.outputPath)
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
    isComplete: artifacts.length > 0 && artifacts.every((artifact) => artifact.status === 'done'),
    applyRequires: schemaDetail.applyRequires ?? [],
    artifacts,
    provenance: { kind: 'static' },
  }
}

function buildStaticGitSnapshot(snapshot: ExportSnapshot): DashboardOverview['git'] {
  const defaultBranch = snapshot.git?.defaultBranch || 'main'
  const repositoryUrl = snapshot.git?.repositoryUrl?.trim() || null
  const recentCommits = snapshot.git?.recentCommits ?? []
  if (recentCommits.length === 0) {
    return {
      bindingToken: null,
      defaultBranch,
      worktrees: [],
    }
  }

  const commitEntries = recentCommits.slice(0, 5).map((commit) => ({
    type: 'commit' as const,
    hash: commit.hash,
    title: commit.title,
    committedAt: commit.committedAt,
    relatedChanges: commit.relatedChanges,
    diff: commit.diff,
  }))

  const aggregateDiff = commitEntries.reduce(
    (acc, entry) => {
      acc.files += entry.diff.files
      acc.insertions += entry.diff.insertions
      acc.deletions += entry.diff.deletions
      return acc
    },
    { files: 0, insertions: 0, deletions: 0 }
  )

  return {
    bindingToken: null,
    defaultBranch,
    worktrees: [
      {
        path: repositoryUrl ?? 'Repository URL unavailable',
        relativePath: 'repo',
        pathAvailable: true,
        branchName: '(snapshot)',
        detached: false,
        isCurrent: true,
        ahead: 0,
        behind: 0,
        diff: aggregateDiff,
        entries: commitEntries,
      },
    ],
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
    trackedTaskProgress: snapChange.trackedTaskProgress,
    documentChecklistSummary: snapChange.documentChecklistSummary,
  }
}

/** Get the source-aware static Spec Catalog. */
export async function getSpecCatalog(): Promise<SpecCatalog> {
  const snapshot = await loadSnapshot()
  if (!snapshot) {
    return {
      entries: [],
      ownedProjection: createStaticSpecCatalogOwnedProjection(),
      referenceSources: [],
      referenceProjection: createStaticSpecCatalogReferenceProjection(undefined),
      observedAt: 0,
    }
  }

  const entries: SpecCatalogEntry[] = snapshot.specs.map((spec) =>
    spec.identity.kind === 'owned'
      ? {
          identity: spec.identity,
          source: 'owned',
          readOnly: false,
          name: spec.name,
          summary: null,
          requirementCount: spec.requirements.length,
          updatedAt: spec.updatedAt,
        }
      : {
          identity: spec.identity,
          source: 'referenced',
          readOnly: true,
          name: spec.name,
          summary: null,
          // Static snapshot carries the parsed body, so requirementCount is not a list-time fact here;
          // the Referenced catalog entry requires the field but the body detail owns the count.
          requirementCount: spec.requirements.length,
          updatedAt: 0,
        }
  )

  return {
    entries,
    ownedProjection: createStaticSpecCatalogOwnedProjection(
      snapshot.specs.filter((spec) => spec.identity.kind === 'owned').length
    ),
    referenceSources:
      snapshot.meta.referencePolicy?.kind === 'include'
        ? snapshot.meta.referencePolicy.referenceSources.map(createStaticSpecCatalogReferenceSource)
        : [],
    referenceProjection: createStaticSpecCatalogReferenceProjection(snapshot.meta.referencePolicy),
    observedAt: snapshot.meta.observedAt || Date.parse(snapshot.meta.timestamp) || 0,
  }
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
      trackedTaskPhaseCounts: { 'no-tasks': 0, 'in-progress': 0, complete: 0 },
      recentArchives: [],
      git: {
        bindingToken: null,
        defaultBranch: 'main',
        worktrees: [],
      },
    }
  }

  const trendPointLimit = Math.max(
    20,
    Math.min(
      500,
      Math.trunc(snapshot.config?.dashboard?.trendPointLimit ?? DASHBOARD_TREND_POINT_LIMIT)
    )
  )
  const rightEdgeTs = snapshot.git?.latestCommitTs ?? null

  const allSpecifications = snapshot.specs.map((spec) => ({
    id: spec.id,
    name: spec.name,
    requirements: spec.requirements.length,
    updatedAt: spec.updatedAt,
  }))
  const specifications = selectRecentDashboardItems(allSpecifications)

  const allActiveChanges = snapshot.changes.map((change) => ({
    id: change.id,
    name: change.name,
    trackedTaskProgress: change.trackedTaskProgress,
    updatedAt: change.updatedAt,
  }))
  const activeChanges = selectRecentDashboardItems(allActiveChanges)

  const requirements = allSpecifications.reduce((sum, spec) => sum + spec.requirements, 0)
  const tasksTotal = allActiveChanges.reduce(
    (sum, change) => sum + change.trackedTaskProgress.total,
    0
  )
  const tasksCompleted = allActiveChanges.reduce(
    (sum, change) => sum + change.trackedTaskProgress.completed,
    0
  )
  const archivedTasksCompleted = snapshot.archives.reduce(
    (sum, archive) => sum + archive.trackedTaskProgress.completed,
    0
  )
  const taskCompletionPercent =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : null
  const inProgressChanges = allActiveChanges.filter(
    (change) => change.trackedTaskProgress.phase === 'in-progress'
  ).length
  const trackedTaskPhaseCounts: DashboardOverview['trackedTaskPhaseCounts'] = {
    'no-tasks': 0,
    'in-progress': 0,
    complete: 0,
  }
  for (const change of allActiveChanges) {
    trackedTaskPhaseCounts[change.trackedTaskProgress.phase] += 1
  }
  const recentArchives = selectRecentDashboardArchives(snapshot.archives).map((archive) => ({
    id: archive.id,
    name: archive.name,
    trackedTaskProgress: archive.trackedTaskProgress,
    archivedAt: resolveArchiveTimestamp(archive),
    updatedAt: archive.updatedAt,
  }))

  const trends = buildStaticObjectiveTrends(snapshot, trendPointLimit, rightEdgeTs)
  const hasObjectiveSpecificationTrend =
    trends.specifications.length > 0 || allSpecifications.length === 0
  const hasObjectiveRequirementTrend = trends.requirements.length > 0 || requirements === 0
  const hasObjectiveCompletedTrend =
    trends.completedChanges.length > 0 || snapshot.archives.length === 0

  return {
    summary: {
      specifications: allSpecifications.length,
      requirements,
      activeChanges: allActiveChanges.length,
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
      pointLimit: trendPointLimit,
      lastUpdatedAt: Date.now(),
    },
    specifications,
    activeChanges,
    trackedTaskPhaseCounts,
    recentArchives,
    git: buildStaticGitSnapshot(snapshot),
  }
}

/** Get the exact compound Spec document from the static snapshot. */
export async function getSpecDocument(identity: SpecIdentity): Promise<SpecDocumentProjection> {
  const snapshot = await loadSnapshot()
  const snapSpec = snapshot?.specs.find(
    (spec) => specIdentityKey(spec.identity) === specIdentityKey(identity)
  )

  if (identity.kind === 'owned') {
    return {
      identity,
      source: 'owned',
      readOnly: false,
      state: snapSpec ? 'ready' : 'not-found',
      spec: snapSpec ? snapshotSpecToSpec(snapSpec) : null,
      rawMarkdown: snapSpec?.content ?? snapSpec?.sourceContent ?? null,
      upstream: null,
      evidence: null,
    }
  }

  // Referenced Spec: only present when the snapshot was exported with --references include.
  const referencePolicy = snapshot?.meta.referencePolicy
  const staticSource =
    referencePolicy?.kind === 'include'
      ? (referencePolicy.referenceSources
          .filter((source) => source.storeId === identity.storeId)
          .map(createStaticSpecCatalogReferenceSource)[0] ?? null)
      : null
  if (!snapSpec) {
    const provenance = !snapshot
      ? {
          kind: 'static' as const,
          state: 'snapshot-unavailable' as const,
          policy: 'absent' as const,
        }
      : referencePolicy?.kind === 'omit'
        ? {
            kind: 'static' as const,
            state: 'omitted' as const,
            policy: 'omit' as const,
            referenceSourceCount: referencePolicy.referenceSourceCount,
          }
        : referencePolicy?.kind === 'none'
          ? { kind: 'static' as const, state: 'none' as const, policy: 'none' as const }
          : {
              kind: 'static' as const,
              state: 'missing' as const,
              policy:
                referencePolicy?.kind === 'include'
                  ? ('include' as const)
                  : ('unrecorded' as const),
              source: staticSource,
            }
    return {
      identity,
      source: 'referenced',
      readOnly: true,
      state: 'error',
      spec: null,
      rawMarkdown: null,
      upstream: null,
      provenance,
      evidence: null,
    }
  }

  return {
    identity,
    source: 'referenced',
    readOnly: true,
    state: 'ready',
    spec: snapshotSpecToSpec(snapSpec),
    rawMarkdown: snapSpec.content ?? snapSpec.sourceContent ?? null,
    upstream: null,
    provenance: {
      kind: 'static',
      state: 'included',
      policy: referencePolicy?.kind === 'include' ? 'include' : 'unrecorded',
      source: staticSource,
    },
    evidence: null,
  }
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
    trackedTaskProgress: change.trackedTaskProgress,
    documentChecklistSummary: change.documentChecklistSummary,
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
  const metadata = snapshot.opsx?.changeMetadata?.[id]

  if (typeof metadata === 'string') {
    files.push({
      path: '.openspec.yaml',
      type: 'file' as const,
      content: metadata,
    })
  }

  files.push({
    path: 'proposal.md',
    type: 'file' as const,
    content: change.sourceProposal ?? change.proposal,
  })

  if (change.tasks) {
    files.push({
      path: 'tasks.md',
      type: 'file' as const,
      content: change.sourceTasks ?? change.tasks,
    })
  }

  if (change.design) {
    files.push({
      path: 'design.md',
      type: 'file' as const,
      content: change.sourceDesign ?? change.design,
    })
  }

  // Add delta spec files
  change.deltas.forEach((delta) => {
    files.push({
      path: `specs/${delta.capability}/spec.md`,
      type: 'file' as const,
      content: delta.sourceContent ?? delta.content,
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
    trackedTaskProgress: archive.trackedTaskProgress,
    documentChecklistSummary: archive.documentChecklistSummary,
    createdAt: archive.createdAt,
    updatedAt: archive.updatedAt,
  }))
}

/**
 * Get a single archive by ID
 */
export async function getArchive(id: string): Promise<OpsxEntityDetail | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return null

  const snapArchive = snapshot.archives.find((a) => a.id === id)
  if (!snapArchive) return null

  return snapArchive.entity
}

/**
 * Get archive files
 */
export async function getArchiveFiles(id: string): Promise<ChangeFile[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  const archive = snapshot.archives.find((a) => a.id === id)
  if (!archive) return []
  return archive.entity.files
}

/**
 * Get UI config (default in static mode)
 */
export async function getConfig(): Promise<OpenSpecUIConfig> {
  const snapshot = await loadSnapshot()
  const defaultConfig: OpenSpecUIConfig = {
    cli: { command: 'openspecui' },
    theme: 'system',
    codeEditor: {
      theme: 'github',
    },
    opsx: {
      agentInvocationMode: 'compose',
    },
    dashboard: {
      trendPointLimit: 100,
    },
    git: {
      diffEagerLineBudget: 1000,
    },
    notifications: {
      sound: DEFAULT_NOTIFICATION_SOUND_ID,
      volume: 1,
      systemNotificationsEnabled: false,
    },
    translation: DocumentTranslationConfigSchema.parse({
      enabled: false,
      targetLanguage: 'zh',
      displayMode: 'direct',
      cacheEnabled: false,
    }),
    terminal: {
      fontSize: 13,
      fontFamily: '',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      useTheme: 'app',
      lightTheme: 'default-light',
      darkTheme: 'default-dark',
      rendererEngine: 'xterm',
      bellSound: DEFAULT_BELL_SOUND_ID,
      bellVolume: 1,
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
    codeEditor: {
      ...defaultConfig.codeEditor,
      ...fromSnapshot.codeEditor,
    },
    opsx: {
      ...defaultConfig.opsx,
      ...fromSnapshot.opsx,
    },
    dashboard: {
      ...defaultConfig.dashboard,
      ...fromSnapshot.dashboard,
    },
    git: {
      ...defaultConfig.git,
      ...fromSnapshot.git,
    },
    notifications: {
      ...defaultConfig.notifications,
      ...fromSnapshot.notifications,
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

/** Return the exported OPSX project configuration, or null when the snapshot omitted it. */
export async function getOpsxProjectConfig(): Promise<string | null> {
  const snapshot = await loadSnapshot()
  return snapshot?.opsx?.configYaml ?? null
}

/** Return all Schema summaries captured in the static snapshot. */
export async function getOpsxSchemas(): Promise<SchemaInfo[]> {
  const snapshot = await loadSnapshot()
  return snapshot?.opsx?.schemas ?? []
}

/** Return the static Schema list together with its detail and resolution projections. */
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

/** Return one exported Schema detail by name. */
export async function getOpsxSchemaDetail(name?: string): Promise<SchemaDetail | null> {
  if (!name) return null
  const snapshot = await loadSnapshot()
  const details = snapshot?.opsx?.schemaDetails
  return details?.[name] ?? null
}

/** Return one exported Schema resolution with display paths projected for static presentation. */
export async function getOpsxSchemaResolution(name?: string): Promise<SchemaResolution | null> {
  if (!name) return null
  const snapshot = await loadSnapshot()
  const resolutions = snapshot?.opsx?.schemaResolutions
  const resolution = resolutions?.[name]
  if (!resolution) return null

  return {
    ...resolution,
    displayPath:
      resolution.displayPath ??
      toOpsxDisplayPath(resolution.path, {
        source: resolution.source,
      }),
    shadows: resolution.shadows.map((shadow) => ({
      ...shadow,
      displayPath:
        shadow.displayPath ??
        toOpsxDisplayPath(shadow.path, {
          source: shadow.source,
        }),
    })),
  }
}

/** Return exported templates for the requested Schema, or the snapshot default Schema. */
export async function getOpsxTemplates(schema?: string): Promise<TemplatesMap | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot?.opsx?.templates) return null
  if (!schema) {
    const first = Object.keys(snapshot.opsx.templates)[0]
    if (!first) return null
    const templates = snapshot.opsx.templates[first]
    return Object.fromEntries(
      Object.entries(templates).map(([artifactId, template]) => [
        artifactId,
        {
          ...template,
          displayPath:
            template.displayPath ??
            toOpsxDisplayPath(template.path, {
              source: template.source,
            }),
        },
      ])
    )
  }
  const templates = snapshot.opsx.templates[schema]
  if (!templates) return null
  return Object.fromEntries(
    Object.entries(templates).map(([artifactId, template]) => [
      artifactId,
      {
        ...template,
        displayPath:
          template.displayPath ??
          toOpsxDisplayPath(template.path, {
            source: template.source,
          }),
      },
    ])
  )
}

/** Reconstruct the exported file tree for one Schema without enabling mutations. */
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
  const schemaRoot = snapshot.opsx.schemaResolutions?.[schemaName]?.path
  const schemaYamlContent = snapshot.opsx.schemaYamls?.[schemaName]
  const templateContentsByArtifact = snapshot.opsx.templateContents?.[schemaName] ?? {}

  const addEntry = (entry: ChangeFile): void => {
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
    addEntry({ path: 'schema.yaml', type: 'file', content: schemaYamlContent })
  }

  const templates = snapshot.opsx.templates?.[schemaName]
  if (templates) {
    Object.entries(templates).forEach(([artifactId, template]) => {
      const relativePath = toSchemaRelativePath(template.path, schemaRoot)
      const templateContent = templateContentsByArtifact[artifactId]?.content ?? undefined
      addDirEntries(relativePath)
      addEntry({ path: relativePath, type: 'file', content: templateContent })
    })
  }

  return entries
}

/** Return the exported YAML document for one Schema. */
export async function getOpsxSchemaYaml(name?: string): Promise<string | null> {
  if (!name) return null
  const snapshot = await loadSnapshot()
  return snapshot?.opsx?.schemaYamls?.[name] ?? null
}

/** Return one exported template document by compound Schema/artifact identity. */
export async function getOpsxTemplateContent(
  schema?: string,
  artifactId?: string
): Promise<{
  content: string | null
  path: string
  displayPath?: string
  source: 'project' | 'user' | 'package'
} | null> {
  if (!schema || !artifactId) return null
  const all = await getOpsxTemplateContents(schema)
  if (!all) return null
  return all[artifactId] ?? null
}

/** Return all exported template documents for the requested or default Schema. */
export async function getOpsxTemplateContents(schema?: string): Promise<Record<
  string,
  {
    content: string | null
    path: string
    displayPath?: string
    source: 'project' | 'user' | 'package'
  }
> | null> {
  const snapshot = await loadSnapshot()
  if (!snapshot?.opsx) return null

  const targetSchema =
    schema ??
    snapshot.opsx.schemas?.[0]?.name ??
    Object.keys(snapshot.opsx.templates ?? {})[0] ??
    null
  if (!targetSchema) return null

  const templates = snapshot.opsx.templates?.[targetSchema] ?? {}
  const contents = snapshot.opsx.templateContents?.[targetSchema] ?? {}
  const merged = Object.fromEntries(
    Object.entries(templates).map(([artifactId, template]) => {
      const contentInfo = contents[artifactId]
      return [
        artifactId,
        {
          content: contentInfo?.content ?? null,
          path: template.path,
          displayPath:
            contentInfo?.displayPath ??
            template.displayPath ??
            toOpsxDisplayPath(template.path, {
              source: template.source,
            }),
          source: template.source,
        },
      ] as const
    })
  )
  return merged
}

/** Return all Change ids available in the static snapshot. */
export async function getOpsxChangeList(): Promise<string[]> {
  const snapshot = await loadSnapshot()
  if (snapshot?.opsx?.changeMetadata) {
    return Object.keys(snapshot.opsx.changeMetadata)
  }
  return snapshot?.changes.map((change) => change.id) ?? []
}

/** Return the exported OPSX metadata document for one Change. */
export async function getOpsxChangeMetadata(changeId?: string): Promise<string | null> {
  if (!changeId) return null
  const snapshot = await loadSnapshot()
  const meta = snapshot?.opsx?.changeMetadata
  if (meta && changeId in meta) {
    return meta[changeId] ?? null
  }
  return null
}

/** Project one Change status from immutable snapshot artifacts. */
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

/** Project status for every static Change. */
export async function getOpsxStatusList(): Promise<ChangeStatus[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []
  return snapshot.changes.map((change) => buildChangeStatus(snapshot, change))
}

/** Return one non-glob artifact output captured for a Change. */
export async function getOpsxArtifactOutput(
  changeId?: string,
  outputPath?: string
): Promise<string | null> {
  if (!changeId || !outputPath) return null
  if (isOpsxGlobPattern(outputPath)) return null

  const snapshot = await loadSnapshot()
  if (!snapshot) return null
  const change = snapshot.changes.find((item) => item.id === changeId)
  if (!change) return null

  return resolveArtifactOutput(change, outputPath)
}

/** Return captured files matching one glob artifact output. */
export async function getOpsxGlobArtifactFiles(
  changeId?: string,
  outputPath?: string
): Promise<GlobArtifactFile[]> {
  if (!changeId || !outputPath) return []
  if (!isOpsxGlobPattern(outputPath)) return []

  const snapshot = await loadSnapshot()
  if (!snapshot) return []
  const change = snapshot.changes.find((item) => item.id === changeId)
  if (!change) return []

  return resolveGlobArtifactFiles(change, outputPath)
}

/** Build the source-scoped static search index from exported entities. */
export async function getSearchDocuments(): Promise<ProjectSearchDocument[]> {
  const snapshot = await loadSnapshot()
  if (!snapshot) return []

  const docs: ProjectSearchDocument[] = []

  for (const spec of snapshot.specs) {
    const identityKey = specIdentityKey(spec.identity)
    const isReferenced = spec.identity.kind === 'referenced'
    docs.push({
      id: `spec:${identityKey}`,
      kind: 'spec',
      // Source isolation: referenced Specs appear only in the Referenced search scope.
      scope: isReferenced ? 'referenced-specs' : 'active-root',
      title: spec.name,
      href: specRoutePath(spec.identity),
      path: isReferenced
        ? `referenced:${spec.identity.kind === 'referenced' ? spec.identity.storeId : ''}:${spec.identity.specId}/spec.md`
        : `owned:openspec/specs/${spec.identity.specId}/spec.md`,
      content: spec.content,
      updatedAt: spec.updatedAt,
    })
  }

  for (const change of snapshot.changes) {
    docs.push({
      id: `change:${change.id}`,
      kind: 'change',
      scope: 'active-root',
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
      scope: 'active-root',
      title: archive.name,
      href: `/archive/${encodeURIComponent(archive.id)}`,
      path: `openspec/changes/archive/${archive.id}`,
      content: archive.entity.files
        .filter((file) => file.type === 'file')
        .map((file) => file.content)
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length > 0)
        .join('\n\n'),
      updatedAt: archive.updatedAt,
    })
  }

  return docs
}
