/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Maintain reactive CLI-backed projections and their direct typed Projection Work readers.
 * 2. Share and release per-entity streams through one planning-root kernel lifecycle.
 * 3. Keep OpenSpec configuration ownership outside the workflow cache while tracking both YAML filename variants.
 * 4. Preserve typed Status and Artifact/Apply/Archive Instructions provenance with the resolved root selector.
 * 5. Keep Change enumeration business truth in the typed CLI result while files only invalidate it.
 *
 * Resolve per-command capabilities once and gate version-only selectors.
 * Original request (2026-07-15): "Planning-root adapters and services consume the CLI-resolved root."
 * Original request (2026-07-23): "OPSX Status 不应等待完整 Kernel warmup，且必须保留 CLI evidence。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-07-31): "系统性地进行修复，因为List页面也有类似的问题。所有可能其它页面都有类似的问题。"

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import { join, matchesGlob, relative, resolve, sep } from 'node:path'
import { z } from 'zod'
import {
  CliApplyInstructionsSuccessSchema,
  CliArchiveInstructionsSuccessSchema,
  CliArtifactInstructionsSuccessSchema,
  CliChangeListSchema,
  CliRootSchema,
  CliWorkflowStatusSuccessSchema,
  type CliCommandResult,
  type CliRootSelector,
} from './cli-contracts/index.js'
import { CliSchemasSuccessSchema, isCliSchemasFailure } from './cli-contracts/schema-resolution.js'
import type { CliExecutor } from './cli-executor.js'
import { mapCliProjectionSeries } from './cli-projection-sequence.js'
import {
  CliProjectionCommandError,
  toCliProjectionCommandEvidence,
  type CliProjectionCommandEvidence,
} from './cli-projection.js'
import { requireCanonicalOpenSpecEntityId, requireOpenSpecEntityRelativePath } from './entity-id.js'
import { inferFileMime, inferFilePreviewKind, isTextLikeFile } from './file-preview.js'
import {
  deriveOpenSpecCliCapabilities,
  parseOpenSpecCliVersion,
  type OpenSpecCliCapabilities,
} from './openspec-compat.js'
import { toOpsxDisplayPath } from './opsx-display-path.js'
import { parseOpsxSchemaDetail } from './opsx-schema-detail.js'
import {
  ApplyInstructionsSchema,
  ArchiveInstructionsSchema,
  ArtifactInstructionsSchema,
  ChangeStatusSchema,
  OpsxCliEvidenceSchema,
  OpsxStatusEvidenceSchema,
  SchemaResolutionSchema,
  TemplatesSchema,
  isGlobPattern,
  type ApplyInstructions,
  type ArchiveInstructions,
  type ArtifactInstructions,
  type ChangeStatus,
  type OpsxConfigBundle,
  type SchemaDetail,
  type SchemaInfo,
  type SchemaResolution,
  type TemplateContentMap,
  type TemplatesMap,
} from './opsx-types.js'
import { ReactiveContext } from './reactive-fs/reactive-context.js'
import {
  reactiveExists,
  reactiveReadDir,
  reactiveReadFile,
  reactiveStat,
} from './reactive-fs/reactive-fs.js'
import { ReactiveState } from './reactive-fs/reactive-state.js'
import type { RuntimeInvalidationReader } from './runtime-invalidation.js'
import type { ChangeFile } from './schemas.js'
import {
  createApplyInstructionProgress,
  projectTaskProjectionsFromMarkdownFiles,
} from './task-progress.js'

export type { TemplateContentMap } from './opsx-types.js'

// ---------------------------------------------------------------------------
// Helpers (migrated from router.ts)
// ---------------------------------------------------------------------------

function toRelativePath(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath)
  return rel.split(sep).join('/')
}

function isAbsoluteFsPath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:\//.test(path)
}

function toAbsoluteProjectPath(projectDir: string, path: string): string {
  return isAbsoluteFsPath(path.replace(/\\/g, '/')) ? path : resolve(projectDir, path)
}

async function readEntriesUnderRoot(root: string): Promise<ChangeFile[]> {
  const rootStat = await reactiveStat(root)
  if (!rootStat?.isDirectory) return []

  const collectEntries = async (dir: string): Promise<ChangeFile[]> => {
    const names = await reactiveReadDir(dir, { includeHidden: false })
    const entries: ChangeFile[] = []

    for (const name of names) {
      const fullPath = join(dir, name)
      const statInfo = await reactiveStat(fullPath)
      if (!statInfo) continue

      const relativePath = toRelativePath(root, fullPath)

      if (statInfo.isDirectory) {
        entries.push({ path: relativePath, type: 'directory' })
        entries.push(...(await collectEntries(fullPath)))
      } else {
        const mime = inferFileMime(relativePath) ?? undefined
        const previewKind = inferFilePreviewKind(relativePath, mime)
        const content = isTextLikeFile(relativePath, mime) ? await reactiveReadFile(fullPath) : null
        const size = content ? Buffer.byteLength(content, 'utf-8') : undefined
        entries.push({
          path: relativePath,
          type: 'file',
          content: content ?? undefined,
          size,
          mime,
          previewKind,
        })
      }
    }

    return entries
  }

  return collectEntries(root)
}

interface GlobArtifactFile {
  path: string
  type: 'file'
  content: string
}

function requireCanonicalArtifactLocation(changeId: string, outputPath: string) {
  return {
    changeId: requireCanonicalOpenSpecEntityId(changeId, 'changeId'),
    outputPath: requireOpenSpecEntityRelativePath(outputPath, 'outputPath'),
  }
}

function splitRelativePathSegments(path: string): string[] {
  return path.replace(/\\/g, '/').split('/').filter(Boolean)
}

function getGlobStaticPrefix(outputPath: string): string {
  const normalizedPath = outputPath.replace(/\\/g, '/')
  const firstGlobIndex = normalizedPath.search(/[*?[]/)
  if (firstGlobIndex === -1) {
    return normalizedPath
  }

  const staticPrefix = normalizedPath.slice(0, firstGlobIndex)
  const lastSlashIndex = staticPrefix.lastIndexOf('/')
  return lastSlashIndex === -1 ? '' : staticPrefix.slice(0, lastSlashIndex)
}

async function readGlobArtifactFiles(
  projectDir: string,
  changeId: string,
  outputPath: string
): Promise<GlobArtifactFile[]> {
  const location = requireCanonicalArtifactLocation(changeId, outputPath)
  const changeDir = join(projectDir, 'openspec', 'changes', location.changeId)
  const allEntries = await readEntriesUnderRoot(changeDir)
  return allEntries
    .filter((entry) => entry.type === 'file' && matchesGlob(entry.path, location.outputPath))
    .map((entry) => ({
      path: entry.path,
      type: 'file' as const,
      content: entry.content ?? '',
    }))
}

// ---------------------------------------------------------------------------
// Reactive touch helpers (register reactive deps so streams re-fire)
// ---------------------------------------------------------------------------

async function touchOpsxProjectDeps(projectDir: string): Promise<void> {
  const openspecDir = join(projectDir, 'openspec')
  await Promise.all([
    reactiveReadFile(join(openspecDir, 'config.yaml')),
    reactiveReadFile(join(openspecDir, 'config.yml')),
  ])
  const schemaRoot = join(openspecDir, 'schemas')
  const schemaDirs = await reactiveReadDir(schemaRoot, {
    directoriesOnly: true,
    includeHidden: true,
  })
  await Promise.all(
    schemaDirs.map((name) => reactiveReadFile(join(schemaRoot, name, 'schema.yaml')))
  )
  await reactiveReadDir(join(openspecDir, 'changes'), {
    directoriesOnly: true,
    includeHidden: true,
    exclude: ['archive'],
  })
}

async function touchOpsxChangeDeps(projectDir: string, changeId: string): Promise<void> {
  const changeDir = join(projectDir, 'openspec', 'changes', changeId)
  await reactiveReadDir(changeDir, { includeHidden: true })
  await reactiveReadFile(join(changeDir, '.openspec.yaml'))
  // Status resolution can depend on any nested artifact path under the change tree,
  // so the reactive dependency graph must cover existing descendants instead of
  // only the top-level directory listing.
  await touchDirectoryTree(changeDir)
}

async function touchDirectoryPathDeps(rootDir: string, relativePath: string): Promise<void> {
  let currentPath = rootDir
  for (const segment of splitRelativePathSegments(relativePath)) {
    currentPath = join(currentPath, segment)
    // Track directory stat so both creation and descendant mutations refresh
    // the status stream, including empty directory creation.
    await reactiveStat(currentPath)
  }
}

async function touchDirectoryTree(rootDir: string): Promise<void> {
  const rootStat = await reactiveStat(rootDir)
  if (!rootStat?.isDirectory) {
    return
  }

  const entries = await reactiveReadDir(rootDir, { includeHidden: true })
  await Promise.all(
    entries.map(async (entryName) => {
      const entryPath = join(rootDir, entryName)
      const entryStat = await reactiveStat(entryPath)
      if (entryStat?.isDirectory) {
        await touchDirectoryTree(entryPath)
      }
    })
  )
}

async function touchArtifactOutputDeps(
  projectDir: string,
  changeId: string,
  outputPath: string
): Promise<void> {
  const location = requireCanonicalArtifactLocation(changeId, outputPath)
  const changeDir = join(projectDir, 'openspec', 'changes', location.changeId)
  const normalizedOutputPath = location.outputPath

  if (isGlobPattern(normalizedOutputPath)) {
    const staticPrefix = getGlobStaticPrefix(normalizedOutputPath)
    if (staticPrefix) {
      await touchDirectoryPathDeps(changeDir, staticPrefix)
    }

    const globRoot = staticPrefix ? join(changeDir, staticPrefix) : changeDir
    await touchDirectoryTree(globRoot)
    return
  }

  const parentPath = splitRelativePathSegments(normalizedOutputPath).slice(0, -1).join('/')
  if (parentPath) {
    await touchDirectoryPathDeps(changeDir, parentPath)
  }

  await reactiveExists(join(changeDir, normalizedOutputPath))
}

function requireCommandData<TInput, TOutput>(
  label: string,
  result: CliCommandResult<TInput>,
  schema: z.ZodType<TOutput>
): TOutput {
  const parsed = schema.safeParse(result.data)
  if (result.success && parsed.success) {
    return parsed.data
  }
  const message =
    result.contractError ||
    result.stderr.trim() ||
    result.diagnostics.map((diagnostic) => diagnostic.message).join('\n')
  throw new CliProjectionCommandError(
    message || `${label} failed (exit ${result.exitCode ?? 'null'})`,
    result
  )
}

function readOpsxRoot(data: unknown) {
  const parsed = z.object({ root: CliRootSchema }).passthrough().safeParse(data)
  return parsed.success ? parsed.data.root : undefined
}

function createOpsxCliEvidence(
  result: CliCommandResult<unknown>,
  command: 'status' | 'instructions' | 'instructions apply' | 'instructions archive',
  rootSelector: CliRootSelector
) {
  const root = readOpsxRoot(result.data)
  return OpsxCliEvidenceSchema.parse({
    command,
    success: result.success,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    payload: result.payload,
    diagnostics: result.diagnostics,
    ...(result.contractError ? { contractError: result.contractError } : {}),
    selector: rootSelector.store === undefined ? {} : { store: rootSelector.store },
    ...(root ? { root } : {}),
  })
}

function createOpsxStatusEvidence(
  result: CliCommandResult<unknown>,
  rootSelector: CliRootSelector
) {
  return OpsxStatusEvidenceSchema.parse(createOpsxCliEvidence(result, 'status', rootSelector))
}

// ---------------------------------------------------------------------------
// OpsxKernel
// ---------------------------------------------------------------------------

export class OpsxKernel {
  private readonly projectDir: string
  private readonly cliExecutor: CliExecutor
  private readonly runtimeInvalidation: RuntimeInvalidationReader
  private readonly rootSelector: CliRootSelector
  private cliCapabilitiesPromise: Promise<OpenSpecCliCapabilities> | null = null
  private readonly controller = new AbortController()
  private warmupPromise: Promise<void> | null = null
  private readonly _streamReady = new Map<string, Promise<void>>()

  // ---- Global data ----
  private _statusList = new ReactiveState<ChangeStatus[]>([])
  private _schemas = new ReactiveState<SchemaInfo[]>([])
  private _changeIds = new ReactiveState<string[]>([])

  // ---- Per-schema data ----
  private _schemaResolutions = new Map<string, ReactiveState<SchemaResolution>>()
  private _schemaDetails = new Map<string, ReactiveState<SchemaDetail>>()
  private _schemaFiles = new Map<string, ReactiveState<ChangeFile[]>>()
  private _schemaYamls = new Map<string, ReactiveState<string | null>>()
  private _templates = new Map<string, ReactiveState<TemplatesMap>>()
  private _templateContents = new Map<string, ReactiveState<TemplateContentMap>>()

  // ---- Per-change data ----
  private _statuses = new Map<string, ReactiveState<ChangeStatus>>()
  private _instructions = new Map<string, ReactiveState<ArtifactInstructions>>()
  private _applyInstructions = new Map<string, ReactiveState<ApplyInstructions>>()
  private _archiveInstructions = new Map<string, ReactiveState<ArchiveInstructions>>()
  private _changeMetadata = new Map<string, ReactiveState<string | null>>()
  private _artifactOutputs = new Map<string, ReactiveState<string | null>>()
  private _globArtifactFiles = new Map<string, ReactiveState<GlobArtifactFile[]>>()

  // ---- Stream abort controllers for dynamic entities ----
  private _entityControllers = new Map<string, AbortController>()

  constructor(
    projectDir: string,
    cliExecutor: CliExecutor,
    runtimeInvalidation: RuntimeInvalidationReader,
    rootSelector: CliRootSelector
  ) {
    this.projectDir = projectDir
    this.cliExecutor = cliExecutor
    this.runtimeInvalidation = runtimeInvalidation
    this.rootSelector = rootSelector
  }

  // =========================================================================
  // Warmup
  // =========================================================================

  async warmup(): Promise<void> {
    if (this.warmupPromise) {
      return this.warmupPromise
    }
    this.warmupPromise = this.runWarmup().catch((error) => {
      this.warmupPromise = null
      throw error
    })
    return this.warmupPromise
  }

  async waitForWarmup(): Promise<void> {
    await this.warmup()
  }

  private async runWarmup(): Promise<void> {
    const signal = this.controller.signal

    // Phase 1: Global data (parallel)
    await Promise.all([
      this.startStreamOnce('global:schemas', this._schemas, () => this.fetchSchemas(), signal),
      this.startStreamOnce(
        'global:change-ids',
        this._changeIds,
        () => this.fetchChangeIds(),
        signal
      ),
    ])

    // Phase 2: Per-schema (after schemas resolved)
    const schemas = this._schemas.get()
    await Promise.all(schemas.map((s) => this.warmupSchema(s.name, signal)))

    // Phase 3: Per-change (after changeIds resolved)
    const changeIds = this._changeIds.get()
    await Promise.all(changeIds.map((id) => this.warmupChange(id, signal)))

    // Phase 4: StatusList (depends on per-change statuses being ready)
    await this.startStreamOnce(
      'global:status-list',
      this._statusList,
      () => this.fetchStatusList(),
      signal
    )

    // Start watchers for dynamic entity management
    this.watchSchemaChanges(signal)
    this.watchChangeIdChanges(signal)
  }

  // =========================================================================
  // Dispose
  // =========================================================================

  dispose(): void {
    this.controller.abort()
    for (const ctrl of this._entityControllers.values()) {
      ctrl.abort()
    }
    this._entityControllers.clear()
    this._streamReady.clear()
    this.warmupPromise = null
  }

  // =========================================================================
  // Public Getters
  // =========================================================================

  getStatusList(): ChangeStatus[] {
    return this._statusList.get()
  }

  getSchemas(): SchemaInfo[] {
    return this._schemas.get()
  }

  getChangeIds(): string[] {
    return this._changeIds.get()
  }

  getTemplates(schema?: string): TemplatesMap {
    const key = schema ?? ''
    const state = this._templates.get(key)
    return state ? state.get() : {}
  }

  getTemplateContents(schema?: string): TemplateContentMap {
    const key = schema ?? ''
    const state = this._templateContents.get(key)
    return state ? state.get() : {}
  }

  getStatus(changeId: string, schema?: string): ChangeStatus {
    const key = `${changeId}:${schema ?? ''}`
    const state = this._statuses.get(key)
    if (!state) {
      throw new Error(`Status not found for change "${changeId}"`)
    }
    return state.get()
  }

  getInstructions(changeId: string, artifact: string, schema?: string): ArtifactInstructions {
    const key = `${changeId}:${artifact}:${schema ?? ''}`
    const state = this._instructions.get(key)
    if (!state) {
      throw new Error(`Instructions not found for change "${changeId}" artifact "${artifact}"`)
    }
    return state.get()
  }

  getApplyInstructions(changeId: string, schema?: string): ApplyInstructions {
    const key = `${changeId}:${schema ?? ''}`
    const state = this._applyInstructions.get(key)
    if (!state) {
      throw new Error(`Apply instructions not found for change "${changeId}"`)
    }
    return state.get()
  }

  getArchiveInstructions(changeId: string, schema?: string): ArchiveInstructions {
    const key = `${changeId}:${schema ?? ''}`
    const state = this._archiveInstructions.get(key)
    if (!state) {
      throw new Error(`Archive instructions not found for change "${changeId}"`)
    }
    return state.get()
  }

  getSchemaResolution(name: string): SchemaResolution {
    const state = this._schemaResolutions.get(name)
    if (!state) {
      throw new Error(`Schema resolution not found for "${name}"`)
    }
    return state.get()
  }

  peekSchemaResolution(name: string): SchemaResolution | null {
    const state = this._schemaResolutions.get(name)
    if (!state) {
      return null
    }
    const value = state.get()
    return value ?? null
  }

  getSchemaDetail(name: string): SchemaDetail {
    const state = this._schemaDetails.get(name)
    if (!state) {
      throw new Error(`Schema detail not found for "${name}"`)
    }
    return state.get()
  }

  peekSchemaDetail(name: string): SchemaDetail | null {
    const state = this._schemaDetails.get(name)
    if (!state) {
      return null
    }
    const value = state.get()
    return value ?? null
  }

  getSchemaFiles(name: string): ChangeFile[] {
    const state = this._schemaFiles.get(name)
    if (!state) {
      throw new Error(`Schema files not found for "${name}"`)
    }
    return state.get()
  }

  getSchemaYaml(name: string): string | null {
    const state = this._schemaYamls.get(name)
    if (!state) {
      throw new Error(`Schema yaml not found for "${name}"`)
    }
    return state.get()
  }

  /** Non-throwing schema detail read; returns null when the schema is not yet loaded. */
  tryGetSchemaDetail(name: string): SchemaDetail | null {
    return this.peekSchemaDetail(name)
  }

  /** Non-throwing schema yaml read; returns null when the schema is not yet loaded. */
  tryGetSchemaYaml(name: string): string | null {
    const state = this._schemaYamls.get(name)
    return state ? state.get() : null
  }

  getChangeMetadata(changeId: string): string | null {
    const state = this._changeMetadata.get(changeId)
    if (!state) return null
    return state.get()
  }

  getArtifactOutput(changeId: string, outputPath: string): string | null {
    const key = `${changeId}:${outputPath}`
    const state = this._artifactOutputs.get(key)
    if (!state) return null
    return state.get()
  }

  getGlobArtifactFiles(changeId: string, outputPath: string): GlobArtifactFile[] {
    const key = `${changeId}:${outputPath}`
    const state = this._globArtifactFiles.get(key)
    if (!state) return []
    return state.get()
  }

  // =========================================================================
  // startStream helper
  // =========================================================================

  private startStream<T>(
    state: ReactiveState<T>,
    task: () => Promise<T>,
    signal: AbortSignal
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const context = new ReactiveContext()
      let first = true
      ;(async () => {
        try {
          for await (const data of context.stream(task, signal)) {
            state.set(data)
            if (first) {
              first = false
              resolve()
            }
          }
        } catch (error) {
          if (first && !signal.aborted) {
            reject(error)
            return
          }
        }
        if (first) resolve()
      })()
    })
  }

  private startStreamOnce<T>(
    key: string,
    state: ReactiveState<T>,
    task: () => Promise<T>,
    signal: AbortSignal
  ): Promise<void> {
    const existing = this._streamReady.get(key)
    if (existing) {
      return existing
    }
    const ready = this.startStream(state, task, signal).catch((error) => {
      this._streamReady.delete(key)
      throw error
    })
    this._streamReady.set(key, ready)
    return ready
  }

  // =========================================================================
  // Per-entity warmup
  // =========================================================================

  private async warmupSchema(name: string, parentSignal: AbortSignal): Promise<void> {
    if (this._entityControllers.has(`schema:${name}`)) {
      return
    }
    const entityCtrl = new AbortController()
    this._entityControllers.set(`schema:${name}`, entityCtrl)

    // Combine parent + entity signal
    const signal = this.combineSignals(parentSignal, entityCtrl.signal)

    // Create states if needed
    if (!this._schemaResolutions.has(name)) {
      this._schemaResolutions.set(name, new ReactiveState<SchemaResolution>(null!))
    }
    if (!this._schemaDetails.has(name)) {
      this._schemaDetails.set(
        name,
        new ReactiveState<SchemaDetail>(null as unknown as SchemaDetail)
      )
    }
    if (!this._schemaFiles.has(name)) {
      this._schemaFiles.set(name, new ReactiveState<ChangeFile[]>([]))
    }
    if (!this._schemaYamls.has(name)) {
      this._schemaYamls.set(name, new ReactiveState<string | null>(null))
    }
    if (!this._templates.has(name)) {
      this._templates.set(name, new ReactiveState<TemplatesMap>({}))
    }
    if (!this._templateContents.has(name)) {
      this._templateContents.set(name, new ReactiveState<TemplateContentMap>({}))
    }

    // Also create default (empty-key) templates if not present
    if (!this._templates.has('')) {
      this._templates.set('', new ReactiveState<TemplatesMap>({}))
    }
    if (!this._templateContents.has('')) {
      this._templateContents.set('', new ReactiveState<TemplateContentMap>({}))
    }

    await Promise.all([
      this.startStreamOnce(
        `schema:${name}:resolution`,
        this._schemaResolutions.get(name)!,
        () => this.fetchSchemaResolution(name),
        signal
      ),
      this.startStreamOnce(
        `schema:${name}:detail`,
        this._schemaDetails.get(name)!,
        () => this.fetchSchemaDetail(name),
        signal
      ),
      this.startStreamOnce(
        `schema:${name}:files`,
        this._schemaFiles.get(name)!,
        () => this.fetchSchemaFiles(name),
        signal
      ),
      this.startStreamOnce(
        `schema:${name}:yaml`,
        this._schemaYamls.get(name)!,
        () => this.fetchSchemaYaml(name),
        signal
      ),
      this.startStreamOnce(
        `schema:${name}:templates`,
        this._templates.get(name)!,
        () => this.fetchTemplates(name),
        signal
      ),
      this.startStreamOnce(
        `schema:${name}:template-contents`,
        this._templateContents.get(name)!,
        () => this.fetchTemplateContents(name),
        signal
      ),
      // Also warm up the default (no-schema) templates
      this.startStreamOnce(
        'schema::templates',
        this._templates.get('')!,
        () => this.fetchTemplates(undefined),
        signal
      ),
      this.startStreamOnce(
        'schema::template-contents',
        this._templateContents.get('')!,
        () => this.fetchTemplateContents(undefined),
        signal
      ),
    ])
  }

  private async warmupChange(changeId: string, parentSignal: AbortSignal): Promise<void> {
    if (this._entityControllers.has(`change:${changeId}`)) {
      return
    }
    const entityCtrl = new AbortController()
    this._entityControllers.set(`change:${changeId}`, entityCtrl)

    const signal = this.combineSignals(parentSignal, entityCtrl.signal)

    // Per-change status (no schema specified = default)
    const statusKey = `${changeId}:`
    if (!this._statuses.has(statusKey)) {
      this._statuses.set(statusKey, new ReactiveState<ChangeStatus>(null!))
    }

    // Change metadata
    if (!this._changeMetadata.has(changeId)) {
      this._changeMetadata.set(changeId, new ReactiveState<string | null>(null))
    }

    // Apply instructions
    const applyKey = `${changeId}:`
    if (!this._applyInstructions.has(applyKey)) {
      this._applyInstructions.set(applyKey, new ReactiveState<ApplyInstructions>(null!))
    }

    const archiveKey = `${changeId}:`
    if (!this._archiveInstructions.has(archiveKey)) {
      this._archiveInstructions.set(archiveKey, new ReactiveState<ArchiveInstructions>(null!))
    }

    // Start status + metadata streams
    await Promise.all([
      this.startStreamOnce(
        `change:${changeId}:status:`,
        this._statuses.get(statusKey)!,
        () => this.fetchStatus(changeId, undefined),
        signal
      ),
      this.startStreamOnce(
        `change:${changeId}:metadata`,
        this._changeMetadata.get(changeId)!,
        () => this.fetchChangeMetadata(changeId),
        signal
      ),
      this.startStreamOnce(
        `change:${changeId}:apply:`,
        this._applyInstructions.get(applyKey)!,
        () => this.fetchApplyInstructions(changeId, undefined),
        signal
      ),
      this.startStreamOnce(
        `change:${changeId}:archive:`,
        this._archiveInstructions.get(archiveKey)!,
        () => this.fetchArchiveInstructions(changeId, undefined),
        signal
      ),
    ])

    // Now warm up per-artifact instructions and outputs from the status
    const status = this._statuses.get(statusKey)?.get()
    if (status?.artifacts) {
      await Promise.all(
        status.artifacts.map(async (artifact) => {
          const instrKey = `${changeId}:${artifact.id}:`
          if (!this._instructions.has(instrKey)) {
            this._instructions.set(instrKey, new ReactiveState<ArtifactInstructions>(null!))
          }
          await this.startStreamOnce(
            `change:${changeId}:instructions:${artifact.id}:`,
            this._instructions.get(instrKey)!,
            () => this.fetchInstructions(changeId, artifact.id, undefined),
            signal
          )

          if (artifact.status === 'skipped') return

          // Warm up artifact output
          const outputKey = `${changeId}:${artifact.outputPath}`
          if (!this._artifactOutputs.has(outputKey)) {
            this._artifactOutputs.set(outputKey, new ReactiveState<string | null>(null))
          }
          await this.startStreamOnce(
            `change:${changeId}:output:${artifact.outputPath}`,
            this._artifactOutputs.get(outputKey)!,
            () => this.fetchArtifactOutput(changeId, artifact.outputPath),
            signal
          )

          // Warm up glob artifact files if it's a glob pattern
          if (
            artifact.outputPath.includes('*') ||
            artifact.outputPath.includes('?') ||
            artifact.outputPath.includes('[')
          ) {
            const globKey = `${changeId}:${artifact.outputPath}`
            if (!this._globArtifactFiles.has(globKey)) {
              this._globArtifactFiles.set(globKey, new ReactiveState<GlobArtifactFile[]>([]))
            }
            await this.startStreamOnce(
              `change:${changeId}:glob:${artifact.outputPath}`,
              this._globArtifactFiles.get(globKey)!,
              () => readGlobArtifactFiles(this.projectDir, changeId, artifact.outputPath),
              signal
            )
          }
        })
      )
    }
  }

  // =========================================================================
  // Dynamic entity management
  // =========================================================================

  private watchSchemaChanges(signal: AbortSignal): void {
    const context = new ReactiveContext()
    ;(async () => {
      let prevNames = new Set(this._schemas.get().map((s) => s.name))
      try {
        for await (const schemas of context.stream(
          () => Promise.resolve(this._schemas.get()),
          signal
        )) {
          const newNames = new Set(schemas.map((s) => s.name))

          // Added schemas
          for (const name of newNames) {
            if (!prevNames.has(name)) {
              this.warmupSchema(name, signal).catch(() => {
                // Ignore dynamic warmup errors; stream retries are reactive.
              })
            }
          }

          // Removed schemas
          for (const name of prevNames) {
            if (!newNames.has(name)) {
              this.teardownEntity(`schema:${name}`)
              this._schemaResolutions.delete(name)
              this._schemaDetails.delete(name)
              this._schemaFiles.delete(name)
              this._schemaYamls.delete(name)
              this._templates.delete(name)
              this._templateContents.delete(name)
              this.clearStreamReadyByPrefix(`schema:${name}:`)
            }
          }

          prevNames = newNames
        }
      } catch {
        // Ignore abort errors
      }
    })()
  }

  private watchChangeIdChanges(signal: AbortSignal): void {
    const context = new ReactiveContext()
    ;(async () => {
      let prevIds = new Set(this._changeIds.get())
      try {
        for await (const ids of context.stream(
          () => Promise.resolve(this._changeIds.get()),
          signal
        )) {
          const newIds = new Set(ids)

          // Added changes
          for (const id of newIds) {
            if (!prevIds.has(id)) {
              this.warmupChange(id, signal).catch(() => {
                // Ignore dynamic warmup errors; stream retries are reactive.
              })
            }
          }

          // Removed changes
          for (const id of prevIds) {
            if (!newIds.has(id)) {
              this.teardownEntity(`change:${id}`)
              // Clean up all per-change states
              for (const key of this._statuses.keys()) {
                if (key.startsWith(`${id}:`)) {
                  this._statuses.delete(key)
                  this._streamReady.delete(`change:${id}:status:${key.slice(id.length + 1)}`)
                }
              }
              for (const key of this._instructions.keys()) {
                if (key.startsWith(`${id}:`)) {
                  this._instructions.delete(key)
                  const suffix = key.slice(id.length + 1)
                  this._streamReady.delete(`change:${id}:instructions:${suffix}`)
                }
              }
              for (const key of this._applyInstructions.keys()) {
                if (key.startsWith(`${id}:`)) {
                  this._applyInstructions.delete(key)
                  this._streamReady.delete(`change:${id}:apply:${key.slice(id.length + 1)}`)
                }
              }
              for (const key of this._archiveInstructions.keys()) {
                if (key.startsWith(`${id}:`)) {
                  this._archiveInstructions.delete(key)
                  this._streamReady.delete(`change:${id}:archive:${key.slice(id.length + 1)}`)
                }
              }
              this._changeMetadata.delete(id)
              this._streamReady.delete(`change:${id}:metadata`)
              for (const key of this._artifactOutputs.keys()) {
                if (key.startsWith(`${id}:`)) {
                  this._artifactOutputs.delete(key)
                  this._streamReady.delete(`change:${id}:output:${key.slice(id.length + 1)}`)
                }
              }
              for (const key of this._globArtifactFiles.keys()) {
                if (key.startsWith(`${id}:`)) {
                  this._globArtifactFiles.delete(key)
                  this._streamReady.delete(`change:${id}:glob:${key.slice(id.length + 1)}`)
                }
              }
              this.clearStreamReadyByPrefix(`change:${id}:`)
            }
          }

          prevIds = newIds
        }
      } catch {
        // Ignore abort errors
      }
    })()
  }

  private teardownEntity(key: string): void {
    const ctrl = this._entityControllers.get(key)
    if (ctrl) {
      ctrl.abort()
      this._entityControllers.delete(key)
    }
  }

  private clearStreamReadyByPrefix(prefix: string): void {
    for (const key of this._streamReady.keys()) {
      if (key.startsWith(prefix)) {
        this._streamReady.delete(key)
      }
    }
  }

  // =========================================================================
  // Fetchers (migrated from router.ts)
  // =========================================================================

  /**
   * Resolve the admitted CLI's per-command capabilities once per Kernel lifetime.
   *
   * The detected version decides whether version-specific selectors and options are forwarded.
   * A failed availability probe yields no capabilities, so no version-only flag is ever sent
   * to an unverifiable CLI.
   */
  private resolveCliCapabilities(): Promise<OpenSpecCliCapabilities> {
    this.cliCapabilitiesPromise ??= this.cliExecutor
      .checkAvailability()
      .then((availability) =>
        deriveOpenSpecCliCapabilities(
          availability.available ? parseOpenSpecCliVersion(availability.version) : null
        )
      )
      .catch(() => deriveOpenSpecCliCapabilities(null))
    return this.cliCapabilitiesPromise
  }

  private async fetchSchemas(): Promise<SchemaInfo[]> {
    return (await this.fetchSchemasProjection()).value
  }

  private async fetchSchemasProjection(): Promise<{
    value: SchemaInfo[]
    evidence: CliProjectionCommandEvidence
  }> {
    this.runtimeInvalidation.track('schemas')
    await touchOpsxProjectDeps(this.projectDir)
    // Forward the selected Root's Store selector only where the admitted CLI declares it:
    // OpenSpec 1.9 resolves schemas through the selected Root; 1.8 rejects `--store`.
    const capabilities = await this.resolveCliCapabilities()
    const schemasSelector: CliRootSelector = capabilities.schemasRootSelector
      ? { ...this.rootSelector }
      : {}
    const result = await this.cliExecutor.contracts.schemas(schemasSelector)
    // OpenSpec 1.9 selected-Root failures emit `{ schemas: [], root: null, status }`
    // with a failing exit code. Preserve that envelope as typed CLI failure
    // evidence instead of letting it pass as an empty successful catalog.
    if (result.data && isCliSchemasFailure(result.data)) {
      throw new CliProjectionCommandError(
        result.data.status.map((diagnostic) => diagnostic.message).join('\n') ||
          'openspec schemas failed to select a Root.',
        result
      )
    }
    return {
      value: requireCommandData('openspec schemas', result, CliSchemasSuccessSchema),
      evidence: toCliProjectionCommandEvidence(result),
    }
  }

  private async fetchChangeIds(): Promise<string[]> {
    const changesDir = join(this.projectDir, 'openspec', 'changes')
    return reactiveReadDir(changesDir, {
      directoriesOnly: true,
      includeHidden: false,
      exclude: ['archive'],
    })
  }

  private async fetchChangeListProjection(): Promise<{
    value: string[]
    evidence: CliProjectionCommandEvidence
  }> {
    // The directory inventory is an invalidation dependency only. OpenSpec CLI owns the list value.
    await this.fetchChangeIds()
    const result = await this.cliExecutor.contracts.listChanges(this.rootSelector)
    const data = requireCommandData('openspec list', result, CliChangeListSchema)
    return {
      value: data.changes.map(({ name }) => name),
      evidence: toCliProjectionCommandEvidence(result),
    }
  }

  private async fetchStatus(changeId: string, schema?: string): Promise<ChangeStatus> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const result = await this.cliExecutor.contracts.workflowStatus(changeId, {
      ...this.rootSelector,
      ...(schema ? { schema } : {}),
    })
    const evidence = createOpsxStatusEvidence(result, this.rootSelector)
    const data = requireCommandData('openspec status', result, CliWorkflowStatusSuccessSchema)
    const status = ChangeStatusSchema.parse({
      changeName: data.changeName,
      schemaName: data.schemaName,
      isPlanningComplete: data.isPlanningComplete,
      applyRequires: data.applyRequires,
      artifacts: data.artifacts,
      provenance: {
        kind: 'cli',
        planningHome: data.planningHome,
        changeRoot: data.changeRoot,
        artifactPaths: data.artifactPaths,
        nextSteps: data.nextSteps,
        actionContext: data.actionContext,
        root: data.root,
        evidence,
      },
    })
    const changeRelDir = `openspec/changes/${changeId}`
    for (const artifact of status.artifacts) {
      if (artifact.status !== 'skipped') {
        artifact.relativePath = `${changeRelDir}/${artifact.outputPath}`
        await touchArtifactOutputDeps(this.projectDir, changeId, artifact.outputPath)
      }
    }
    return status
  }

  private async fetchStatusList(): Promise<ChangeStatus[]> {
    await this.ensureChangeIds()
    const changeIds = this._changeIds.get()
    await mapCliProjectionSeries(changeIds, (id) => this.ensureStatus(id))
    return changeIds.map((id) => this.getStatus(id))
  }

  private async fetchInstructions(
    changeId: string,
    artifact: string,
    schema?: string
  ): Promise<ArtifactInstructions> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const result = await this.cliExecutor.contracts.artifactInstructions(changeId, artifact, {
      ...this.rootSelector,
      ...(schema ? { schema } : {}),
    })
    const data = requireCommandData(
      'openspec instructions',
      result,
      CliArtifactInstructionsSuccessSchema
    )
    return ArtifactInstructionsSchema.parse({
      ...data,
      evidence: createOpsxCliEvidence(result, 'instructions', this.rootSelector),
    })
  }

  private async fetchApplyInstructions(
    changeId: string,
    schema?: string
  ): Promise<ApplyInstructions> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const result = await this.cliExecutor.contracts.applyInstructions(changeId, {
      ...this.rootSelector,
      ...(schema ? { schema } : {}),
    })
    const data = requireCommandData(
      'openspec instructions apply',
      result,
      CliApplyInstructionsSuccessSchema
    )
    const instructions = ApplyInstructionsSchema.parse({
      ...data,
      evidence: createOpsxCliEvidence(result, 'instructions apply', this.rootSelector),
    })
    const changeDir = join(this.projectDir, 'openspec', 'changes', changeId)
    const [files, schemaDetail] = await Promise.all([
      readEntriesUnderRoot(changeDir),
      this.fetchSchemaResolution(instructions.schemaName)
        .then((resolution) =>
          this.fetchSchemaDetailAtResolution(instructions.schemaName, resolution)
        )
        .catch(() => null),
    ])
    const { trackedTaskProgress } = projectTaskProjectionsFromMarkdownFiles(files, {
      schemaDetail,
      hasSchemaMetadata: true,
    })

    return {
      ...instructions,
      applyInstructionProgress: createApplyInstructionProgress(
        instructions.applyInstructionProgress,
        trackedTaskProgress
      ),
    }
  }

  private async fetchArchiveInstructions(
    changeId: string,
    schema?: string
  ): Promise<ArchiveInstructions> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const result = await this.cliExecutor.contracts.archiveInstructions(changeId, {
      ...this.rootSelector,
      ...(schema ? { schema } : {}),
    })
    const data = requireCommandData(
      'openspec instructions archive',
      result,
      CliArchiveInstructionsSuccessSchema
    )
    return ArchiveInstructionsSchema.parse({
      ...data,
      evidence: createOpsxCliEvidence(result, 'instructions archive', this.rootSelector),
    })
  }

  private async fetchSchemaResolution(name: string): Promise<SchemaResolution> {
    return (await this.fetchSchemaResolutionProjection(name)).value
  }

  private async fetchSchemaResolutionProjection(name: string): Promise<{
    value: SchemaResolution
    evidence: CliProjectionCommandEvidence
  }> {
    await touchOpsxProjectDeps(this.projectDir)
    const result = await this.cliExecutor.contracts.schemaWhich(name)
    const value = requireCommandData('openspec schema which', result, SchemaResolutionSchema)
    return {
      evidence: toCliProjectionCommandEvidence(result),
      value: {
        ...value,
        displayPath: toOpsxDisplayPath(value.path, {
          source: value.source,
          projectDir: this.projectDir,
        }),
        shadows: value.shadows.map((shadow) => ({
          ...shadow,
          displayPath: toOpsxDisplayPath(shadow.path, {
            source: shadow.source,
            projectDir: this.projectDir,
          }),
        })),
      },
    }
  }

  private async fetchSchemaDetail(name: string): Promise<SchemaDetail> {
    await touchOpsxProjectDeps(this.projectDir)
    await this.ensureSchemaResolution(name)
    return this.fetchSchemaDetailAtResolution(name, this.getSchemaResolution(name))
  }

  private async fetchSchemaDetailAtResolution(
    name: string,
    resolution: SchemaResolution
  ): Promise<SchemaDetail> {
    const schemaPath = join(resolution.path, 'schema.yaml')
    const content = await reactiveReadFile(schemaPath)
    if (!content) {
      throw new Error(`schema.yaml not found at ${schemaPath}`)
    }
    return parseSchemaYamlInline(content, name, schemaPath)
  }

  private async fetchSchemaFiles(name: string): Promise<ChangeFile[]> {
    await touchOpsxProjectDeps(this.projectDir)
    await this.ensureSchemaResolution(name)
    const resolution = this.getSchemaResolution(name)
    return readEntriesUnderRoot(resolution.path)
  }

  private async fetchSchemaYaml(name: string): Promise<string | null> {
    await touchOpsxProjectDeps(this.projectDir)
    await this.ensureSchemaResolution(name)
    const resolution = this.getSchemaResolution(name)
    const schemaPath = join(resolution.path, 'schema.yaml')
    return reactiveReadFile(schemaPath)
  }

  private async fetchTemplates(schema?: string): Promise<TemplatesMap> {
    return (await this.fetchTemplatesProjection(schema)).value
  }

  private async fetchTemplatesProjection(schema?: string): Promise<{
    value: TemplatesMap
    evidence: CliProjectionCommandEvidence
  }> {
    await touchOpsxProjectDeps(this.projectDir)
    const result = await this.cliExecutor.contracts.templates(schema)
    const templates = requireCommandData('openspec templates', result, TemplatesSchema)
    const value = Object.fromEntries(
      Object.entries(templates).map(([artifactId, info]) => [
        artifactId,
        {
          ...info,
          path: toAbsoluteProjectPath(this.projectDir, info.path),
          displayPath: toOpsxDisplayPath(info.path, {
            source: info.source,
            projectDir: this.projectDir,
          }),
        },
      ])
    )
    return { value, evidence: toCliProjectionCommandEvidence(result) }
  }

  private async fetchTemplateContents(schema?: string): Promise<TemplateContentMap> {
    await this.ensureTemplates(schema)
    return this.readTemplateContents(this.getTemplates(schema))
  }

  private async readTemplateContents(templates: TemplatesMap): Promise<TemplateContentMap> {
    const entries = await Promise.all(
      Object.entries(templates).map(async ([artifactId, info]) => {
        const content = await reactiveReadFile(info.path)
        return [
          artifactId,
          {
            content,
            path: info.path,
            displayPath:
              info.displayPath ??
              toOpsxDisplayPath(info.path, {
                source: info.source,
                projectDir: this.projectDir,
              }),
            source: info.source,
          },
        ] as const
      })
    )
    return Object.fromEntries(entries)
  }

  private async fetchChangeMetadata(changeId: string): Promise<string | null> {
    const metadataPath = join(this.projectDir, 'openspec', 'changes', changeId, '.openspec.yaml')
    return reactiveReadFile(metadataPath)
  }

  private async fetchArtifactOutput(changeId: string, outputPath: string): Promise<string | null> {
    const location = requireCanonicalArtifactLocation(changeId, outputPath)
    const artifactPath = join(
      this.projectDir,
      'openspec',
      'changes',
      location.changeId,
      location.outputPath
    )
    return reactiveReadFile(artifactPath)
  }

  // =========================================================================
  // Direct Projection Work readers
  // =========================================================================

  /** Execute one Status projection with dependencies owned by the caller's reactive generation. */
  readStatusProjection(changeId: string, schema?: string): Promise<ChangeStatus> {
    return this.fetchStatus(changeId, schema)
  }

  /** Execute CLI-owned Change enumeration with file dependencies owned by the caller's Work generation. */
  readChangeListProjection(): Promise<{
    value: string[]
    evidence: CliProjectionCommandEvidence
  }> {
    return this.fetchChangeListProjection()
  }

  /** Execute the current Change Status list without joining the Kernel's retained entity streams. */
  async readStatusListProjection(): Promise<{
    value: ChangeStatus[]
    evidence: CliProjectionCommandEvidence
  }> {
    const changeList = await this.fetchChangeListProjection()
    return {
      value: await mapCliProjectionSeries(changeList.value, (changeId) =>
        this.fetchStatus(changeId)
      ),
      evidence: changeList.evidence,
    }
  }

  /** Execute one artifact-instructions projection in the caller-owned Work generation. */
  readInstructionsProjection(
    changeId: string,
    artifact: string,
    schema?: string
  ): Promise<ArtifactInstructions> {
    return this.fetchInstructions(changeId, artifact, schema)
  }

  /** Execute one Apply-instructions projection in the caller-owned Work generation. */
  readApplyInstructionsProjection(changeId: string, schema?: string): Promise<ApplyInstructions> {
    return this.fetchApplyInstructions(changeId, schema)
  }

  /** Execute one Archive-instructions projection in the caller-owned Work generation. */
  readArchiveInstructionsProjection(
    changeId: string,
    schema?: string
  ): Promise<ArchiveInstructions> {
    return this.fetchArchiveInstructions(changeId, schema)
  }

  /** Execute the aggregate Schema bundle while retaining exact resolved-file dependencies. */
  async readConfigBundleProjection(): Promise<{
    value: OpsxConfigBundle
    evidence: {
      schemas: CliProjectionCommandEvidence
      schemaResolutions: Record<string, CliProjectionCommandEvidence>
    }
  }> {
    const schemasProjection = await this.fetchSchemasProjection()
    const details = await mapCliProjectionSeries(schemasProjection.value, async ({ name }) => {
      const resolution = await this.fetchSchemaResolutionProjection(name)
      const detail = await this.fetchSchemaDetailAtResolution(name, resolution.value).catch(
        () => null
      )
      return { name, detail, resolution }
    })
    return {
      value: {
        schemas: schemasProjection.value,
        schemaDetails: Object.fromEntries(details.map(({ name, detail }) => [name, detail])),
        schemaResolutions: Object.fromEntries(
          details.map(({ name, resolution }) => [name, resolution.value])
        ),
      },
      evidence: {
        schemas: schemasProjection.evidence,
        schemaResolutions: Object.fromEntries(
          details.map(({ name, resolution }) => [name, resolution.evidence])
        ),
      },
    }
  }

  /** Execute one CLI template-index projection. */
  readTemplatesProjection(schema?: string): Promise<{
    value: TemplatesMap
    evidence: CliProjectionCommandEvidence
  }> {
    return this.fetchTemplatesProjection(schema)
  }

  /** Execute one template-content projection from the CLI-selected template index. */
  async readTemplateContentsProjection(schema?: string): Promise<{
    value: TemplateContentMap
    evidence: CliProjectionCommandEvidence
  }> {
    const templates = await this.fetchTemplatesProjection(schema)
    return {
      value: await this.readTemplateContents(templates.value),
      evidence: templates.evidence,
    }
  }

  // =========================================================================
  // Utility: Ensure on-demand (lazy fallback for unknown keys)
  // =========================================================================

  async ensureSchemas(): Promise<void> {
    await this.startStreamOnce(
      'global:schemas',
      this._schemas,
      () => this.fetchSchemas(),
      this.controller.signal
    )
  }

  async ensureChangeIds(): Promise<void> {
    await this.startStreamOnce(
      'global:change-ids',
      this._changeIds,
      () => this.fetchChangeIds(),
      this.controller.signal
    )
  }

  async ensureStatusList(): Promise<void> {
    await this.startStreamOnce(
      'global:status-list',
      this._statusList,
      () => this.fetchStatusList(),
      this.controller.signal
    )
  }

  async ensureStatus(changeId: string, schema?: string): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const key = `${canonicalChangeId}:${schema ?? ''}`
    if (!this._statuses.has(key)) {
      this._statuses.set(key, new ReactiveState<ChangeStatus>(null!))
    }
    await this.startStreamOnce(
      `change:${canonicalChangeId}:status:${schema ?? ''}`,
      this._statuses.get(key)!,
      () => this.fetchStatus(canonicalChangeId, schema),
      this.controller.signal
    )
  }

  async ensureInstructions(changeId: string, artifact: string, schema?: string): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const key = `${canonicalChangeId}:${artifact}:${schema ?? ''}`
    if (!this._instructions.has(key)) {
      this._instructions.set(key, new ReactiveState<ArtifactInstructions>(null!))
    }
    await this.startStreamOnce(
      `change:${canonicalChangeId}:instructions:${artifact}:${schema ?? ''}`,
      this._instructions.get(key)!,
      () => this.fetchInstructions(canonicalChangeId, artifact, schema),
      this.controller.signal
    )
  }

  async ensureApplyInstructions(changeId: string, schema?: string): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const key = `${canonicalChangeId}:${schema ?? ''}`
    if (!this._applyInstructions.has(key)) {
      this._applyInstructions.set(key, new ReactiveState<ApplyInstructions>(null!))
    }
    await this.startStreamOnce(
      `change:${canonicalChangeId}:apply:${schema ?? ''}`,
      this._applyInstructions.get(key)!,
      () => this.fetchApplyInstructions(canonicalChangeId, schema),
      this.controller.signal
    )
  }

  async ensureArchiveInstructions(changeId: string, schema?: string): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const key = `${canonicalChangeId}:${schema ?? ''}`
    if (!this._archiveInstructions.has(key)) {
      this._archiveInstructions.set(key, new ReactiveState<ArchiveInstructions>(null!))
    }
    await this.startStreamOnce(
      `change:${canonicalChangeId}:archive:${schema ?? ''}`,
      this._archiveInstructions.get(key)!,
      () => this.fetchArchiveInstructions(canonicalChangeId, schema),
      this.controller.signal
    )
  }

  async ensureArtifactOutput(changeId: string, outputPath: string): Promise<void> {
    const location = requireCanonicalArtifactLocation(changeId, outputPath)
    const key = `${location.changeId}:${location.outputPath}`
    if (!this._artifactOutputs.has(key)) {
      this._artifactOutputs.set(key, new ReactiveState<string | null>(null))
    }
    await this.startStreamOnce(
      `change:${location.changeId}:output:${location.outputPath}`,
      this._artifactOutputs.get(key)!,
      () => this.fetchArtifactOutput(location.changeId, location.outputPath),
      this.controller.signal
    )
  }

  async ensureGlobArtifactFiles(changeId: string, outputPath: string): Promise<void> {
    const location = requireCanonicalArtifactLocation(changeId, outputPath)
    const key = `${location.changeId}:${location.outputPath}`
    if (!this._globArtifactFiles.has(key)) {
      this._globArtifactFiles.set(key, new ReactiveState<GlobArtifactFile[]>([]))
    }
    await this.startStreamOnce(
      `change:${location.changeId}:glob:${location.outputPath}`,
      this._globArtifactFiles.get(key)!,
      () => readGlobArtifactFiles(this.projectDir, location.changeId, location.outputPath),
      this.controller.signal
    )
  }

  async ensureSchemaResolution(name: string): Promise<void> {
    if (!this._schemaResolutions.has(name)) {
      this._schemaResolutions.set(name, new ReactiveState<SchemaResolution>(null!))
    }
    await this.startStreamOnce(
      `schema:${name}:resolution`,
      this._schemaResolutions.get(name)!,
      () => this.fetchSchemaResolution(name),
      this.controller.signal
    )
  }

  async ensureSchemaDetail(name: string): Promise<void> {
    if (!this._schemaDetails.has(name)) {
      this._schemaDetails.set(
        name,
        new ReactiveState<SchemaDetail>(null as unknown as SchemaDetail)
      )
    }
    await this.startStreamOnce(
      `schema:${name}:detail`,
      this._schemaDetails.get(name)!,
      () => this.fetchSchemaDetail(name),
      this.controller.signal
    )
  }

  async ensureSchemaFiles(name: string): Promise<void> {
    if (!this._schemaFiles.has(name)) {
      this._schemaFiles.set(name, new ReactiveState<ChangeFile[]>([]))
    }
    await this.startStreamOnce(
      `schema:${name}:files`,
      this._schemaFiles.get(name)!,
      () => this.fetchSchemaFiles(name),
      this.controller.signal
    )
  }

  async ensureSchemaYaml(name: string): Promise<void> {
    if (!this._schemaYamls.has(name)) {
      this._schemaYamls.set(name, new ReactiveState<string | null>(null))
    }
    await this.startStreamOnce(
      `schema:${name}:yaml`,
      this._schemaYamls.get(name)!,
      () => this.fetchSchemaYaml(name),
      this.controller.signal
    )
  }

  async ensureTemplates(schema?: string): Promise<void> {
    const key = schema ?? ''
    if (!this._templates.has(key)) {
      this._templates.set(key, new ReactiveState<TemplatesMap>({}))
    }
    await this.startStreamOnce(
      `schema:${key}:templates`,
      this._templates.get(key)!,
      () => this.fetchTemplates(schema),
      this.controller.signal
    )
  }

  async ensureTemplateContents(schema?: string): Promise<void> {
    const key = schema ?? ''
    if (!this._templateContents.has(key)) {
      this._templateContents.set(key, new ReactiveState<TemplateContentMap>({}))
    }
    await this.startStreamOnce(
      `schema:${key}:template-contents`,
      this._templateContents.get(key)!,
      () => this.fetchTemplateContents(schema),
      this.controller.signal
    )
  }

  async ensureChangeMetadata(changeId: string): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    if (!this._changeMetadata.has(canonicalChangeId)) {
      this._changeMetadata.set(canonicalChangeId, new ReactiveState<string | null>(null))
    }
    await this.startStreamOnce(
      `change:${canonicalChangeId}:metadata`,
      this._changeMetadata.get(canonicalChangeId)!,
      () => this.fetchChangeMetadata(canonicalChangeId),
      this.controller.signal
    )
  }

  // =========================================================================
  // Signal utilities
  // =========================================================================

  private combineSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
    const ctrl = new AbortController()
    const abort = () => ctrl.abort()
    if (a.aborted || b.aborted) {
      ctrl.abort()
      return ctrl.signal
    }
    a.addEventListener('abort', abort, { once: true })
    b.addEventListener('abort', abort, { once: true })
    return ctrl.signal
  }
}

function parseSchemaYamlInline(content: string, fallbackName: string, path: string): SchemaDetail {
  return parseOpsxSchemaDetail(content, fallbackName, { path }).detail
}
