import { join, matchesGlob, relative, sep } from 'node:path'
import { z } from 'zod'
import type { CliExecutor } from './cli-executor.js'
import {
  ApplyInstructionsSchema,
  ArtifactInstructionsSchema,
  ChangeStatusSchema,
  SchemaInfoSchema,
  SchemaResolutionSchema,
  TemplatesSchema,
  type ApplyInstructions,
  type ArtifactInstructions,
  type ChangeStatus,
  type SchemaInfo,
  type SchemaResolution,
  type TemplatesMap,
} from './opsx-types.js'
import { ReactiveContext } from './reactive-fs/reactive-context.js'
import { reactiveReadDir, reactiveReadFile, reactiveStat } from './reactive-fs/reactive-fs.js'
import { ReactiveState } from './reactive-fs/reactive-state.js'
import type { ChangeFile } from './schemas.js'

// Re-export TemplateContentMap so router and others can use it
export type TemplateContentMap = Record<
  string,
  { content: string | null; path: string; source: TemplatesMap[string]['source'] }
>

// ---------------------------------------------------------------------------
// Helpers (migrated from router.ts)
// ---------------------------------------------------------------------------

function parseCliJson<T>(raw: string, schema: z.ZodSchema<T>, label: string): T {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error(`${label} returned empty output`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`${label} returned invalid JSON: ${message}`)
  }
  const result = schema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`${label} returned unexpected JSON: ${result.error.message}`)
  }
  return result.data
}

function toRelativePath(root: string, absolutePath: string): string {
  const rel = relative(root, absolutePath)
  return rel.split(sep).join('/')
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
        const content = await reactiveReadFile(fullPath)
        const size = content ? Buffer.byteLength(content, 'utf-8') : undefined
        entries.push({
          path: relativePath,
          type: 'file',
          content: content ?? undefined,
          size,
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

async function readGlobArtifactFiles(
  projectDir: string,
  changeId: string,
  outputPath: string
): Promise<GlobArtifactFile[]> {
  const changeDir = join(projectDir, 'openspec', 'changes', changeId)
  const allEntries = await readEntriesUnderRoot(changeDir)
  return allEntries
    .filter((entry) => entry.type === 'file' && matchesGlob(entry.path, outputPath))
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
  await reactiveReadFile(join(openspecDir, 'config.yaml'))
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
}

// ---------------------------------------------------------------------------
// OpsxKernel
// ---------------------------------------------------------------------------

export class OpsxKernel {
  private readonly projectDir: string
  private readonly cliExecutor: CliExecutor
  private readonly controller = new AbortController()
  private warmupPromise: Promise<void> | null = null
  private readonly _streamReady = new Map<string, Promise<void>>()

  // ---- Global data ----
  private _statusList = new ReactiveState<ChangeStatus[]>([])
  private _schemas = new ReactiveState<SchemaInfo[]>([])
  private _changeIds = new ReactiveState<string[]>([])
  private _projectConfig = new ReactiveState<string | null>(null)

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
  private _changeMetadata = new Map<string, ReactiveState<string | null>>()
  private _artifactOutputs = new Map<string, ReactiveState<string | null>>()
  private _globArtifactFiles = new Map<string, ReactiveState<GlobArtifactFile[]>>()

  // ---- Stream abort controllers for dynamic entities ----
  private _entityControllers = new Map<string, AbortController>()

  constructor(projectDir: string, cliExecutor: CliExecutor) {
    this.projectDir = projectDir
    this.cliExecutor = cliExecutor
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
      this.startStreamOnce(
        'global:project-config',
        this._projectConfig,
        () => this.fetchProjectConfig(),
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

  getProjectConfig(): string | null {
    return this._projectConfig.get()
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

  private async fetchSchemas(): Promise<SchemaInfo[]> {
    await touchOpsxProjectDeps(this.projectDir)
    const result = await this.cliExecutor.schemas()
    if (!result.success) {
      throw new Error(
        result.stderr || `openspec schemas failed (exit ${result.exitCode ?? 'null'})`
      )
    }
    return parseCliJson(result.stdout, z.array(SchemaInfoSchema), 'openspec schemas')
  }

  private async fetchChangeIds(): Promise<string[]> {
    const changesDir = join(this.projectDir, 'openspec', 'changes')
    return reactiveReadDir(changesDir, {
      directoriesOnly: true,
      includeHidden: false,
      exclude: ['archive'],
    })
  }

  private async fetchProjectConfig(): Promise<string | null> {
    const configPath = join(this.projectDir, 'openspec', 'config.yaml')
    return reactiveReadFile(configPath)
  }

  private async fetchStatus(changeId: string, schema?: string): Promise<ChangeStatus> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const args = ['status', '--json', '--change', changeId]
    if (schema) args.push('--schema', schema)

    const result = await this.cliExecutor.execute(args)
    if (!result.success) {
      throw new Error(result.stderr || `openspec status failed (exit ${result.exitCode ?? 'null'})`)
    }
    const status = parseCliJson(result.stdout, ChangeStatusSchema, 'openspec status')
    const changeRelDir = `openspec/changes/${changeId}`
    for (const artifact of status.artifacts) {
      artifact.relativePath = `${changeRelDir}/${artifact.outputPath}`
    }
    return status
  }

  private async fetchStatusList(): Promise<ChangeStatus[]> {
    await this.ensureChangeIds()
    const changeIds = this._changeIds.get()
    await Promise.all(changeIds.map((id) => this.ensureStatus(id)))
    return changeIds.map((id) => this.getStatus(id))
  }

  private async fetchInstructions(
    changeId: string,
    artifact: string,
    schema?: string
  ): Promise<ArtifactInstructions> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const args = ['instructions', artifact, '--json', '--change', changeId]
    if (schema) args.push('--schema', schema)

    const result = await this.cliExecutor.execute(args)
    if (!result.success) {
      throw new Error(
        result.stderr || `openspec instructions failed (exit ${result.exitCode ?? 'null'})`
      )
    }
    return parseCliJson(result.stdout, ArtifactInstructionsSchema, 'openspec instructions')
  }

  private async fetchApplyInstructions(
    changeId: string,
    schema?: string
  ): Promise<ApplyInstructions> {
    await touchOpsxProjectDeps(this.projectDir)
    await touchOpsxChangeDeps(this.projectDir, changeId)

    const args = ['instructions', 'apply', '--json', '--change', changeId]
    if (schema) args.push('--schema', schema)

    const result = await this.cliExecutor.execute(args)
    if (!result.success) {
      throw new Error(
        result.stderr || `openspec instructions apply failed (exit ${result.exitCode ?? 'null'})`
      )
    }
    return parseCliJson(result.stdout, ApplyInstructionsSchema, 'openspec instructions apply')
  }

  private async fetchSchemaResolution(name: string): Promise<SchemaResolution> {
    await touchOpsxProjectDeps(this.projectDir)
    const result = await this.cliExecutor.schemaWhich(name)
    if (!result.success) {
      throw new Error(
        result.stderr || `openspec schema which failed (exit ${result.exitCode ?? 'null'})`
      )
    }
    return parseCliJson(result.stdout, SchemaResolutionSchema, 'openspec schema which')
  }

  private async fetchSchemaDetail(name: string): Promise<SchemaDetail> {
    await touchOpsxProjectDeps(this.projectDir)
    await this.ensureSchemaResolution(name)
    const resolution = this.getSchemaResolution(name)
    const schemaPath = join(resolution.path, 'schema.yaml')
    const content = await reactiveReadFile(schemaPath)
    if (!content) {
      throw new Error(`schema.yaml not found at ${schemaPath}`)
    }
    return parseSchemaYamlInline(content)
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
    await touchOpsxProjectDeps(this.projectDir)
    const result = await this.cliExecutor.templates(schema)
    if (!result.success) {
      throw new Error(
        result.stderr || `openspec templates failed (exit ${result.exitCode ?? 'null'})`
      )
    }
    return parseCliJson(result.stdout, TemplatesSchema, 'openspec templates')
  }

  private async fetchTemplateContents(schema?: string): Promise<TemplateContentMap> {
    await this.ensureTemplates(schema)
    const templates = this.getTemplates(schema)
    const entries = await Promise.all(
      Object.entries(templates).map(async ([artifactId, info]) => {
        const content = await reactiveReadFile(info.path)
        return [artifactId, { content, path: info.path, source: info.source }] as const
      })
    )
    return Object.fromEntries(entries)
  }

  private async fetchChangeMetadata(changeId: string): Promise<string | null> {
    const metadataPath = join(this.projectDir, 'openspec', 'changes', changeId, '.openspec.yaml')
    return reactiveReadFile(metadataPath)
  }

  private async fetchArtifactOutput(changeId: string, outputPath: string): Promise<string | null> {
    const artifactPath = join(this.projectDir, 'openspec', 'changes', changeId, outputPath)
    return reactiveReadFile(artifactPath)
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

  async ensureProjectConfig(): Promise<void> {
    await this.startStreamOnce(
      'global:project-config',
      this._projectConfig,
      () => this.fetchProjectConfig(),
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
    const key = `${changeId}:${schema ?? ''}`
    if (!this._statuses.has(key)) {
      this._statuses.set(key, new ReactiveState<ChangeStatus>(null!))
    }
    await this.startStreamOnce(
      `change:${changeId}:status:${schema ?? ''}`,
      this._statuses.get(key)!,
      () => this.fetchStatus(changeId, schema),
      this.controller.signal
    )
  }

  async ensureInstructions(changeId: string, artifact: string, schema?: string): Promise<void> {
    const key = `${changeId}:${artifact}:${schema ?? ''}`
    if (!this._instructions.has(key)) {
      this._instructions.set(key, new ReactiveState<ArtifactInstructions>(null!))
    }
    await this.startStreamOnce(
      `change:${changeId}:instructions:${artifact}:${schema ?? ''}`,
      this._instructions.get(key)!,
      () => this.fetchInstructions(changeId, artifact, schema),
      this.controller.signal
    )
  }

  async ensureApplyInstructions(changeId: string, schema?: string): Promise<void> {
    const key = `${changeId}:${schema ?? ''}`
    if (!this._applyInstructions.has(key)) {
      this._applyInstructions.set(key, new ReactiveState<ApplyInstructions>(null!))
    }
    await this.startStreamOnce(
      `change:${changeId}:apply:${schema ?? ''}`,
      this._applyInstructions.get(key)!,
      () => this.fetchApplyInstructions(changeId, schema),
      this.controller.signal
    )
  }

  async ensureArtifactOutput(changeId: string, outputPath: string): Promise<void> {
    const key = `${changeId}:${outputPath}`
    if (!this._artifactOutputs.has(key)) {
      this._artifactOutputs.set(key, new ReactiveState<string | null>(null))
    }
    await this.startStreamOnce(
      `change:${changeId}:output:${outputPath}`,
      this._artifactOutputs.get(key)!,
      () => this.fetchArtifactOutput(changeId, outputPath),
      this.controller.signal
    )
  }

  async ensureGlobArtifactFiles(changeId: string, outputPath: string): Promise<void> {
    const key = `${changeId}:${outputPath}`
    if (!this._globArtifactFiles.has(key)) {
      this._globArtifactFiles.set(key, new ReactiveState<GlobArtifactFile[]>([]))
    }
    await this.startStreamOnce(
      `change:${changeId}:glob:${outputPath}`,
      this._globArtifactFiles.get(key)!,
      () => readGlobArtifactFiles(this.projectDir, changeId, outputPath),
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
    if (!this._changeMetadata.has(changeId)) {
      this._changeMetadata.set(changeId, new ReactiveState<string | null>(null))
    }
    await this.startStreamOnce(
      `change:${changeId}:metadata`,
      this._changeMetadata.get(changeId)!,
      () => this.fetchChangeMetadata(changeId),
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

// ---------------------------------------------------------------------------
// Inline schema.yaml parser (same logic as opsx-schema.ts)
// ---------------------------------------------------------------------------

import { parse as parseYaml } from 'yaml'
import { SchemaDetailSchema, type SchemaDetail } from './opsx-types.js'

const SchemaYamlArtifactSchema = z.object({
  id: z.string(),
  generates: z.string(),
  description: z.string().optional(),
  template: z.string().optional(),
  instruction: z.string().optional(),
  requires: z.array(z.string()).optional(),
})

const SchemaYamlSchema = z.object({
  name: z.string(),
  version: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
  artifacts: z.array(SchemaYamlArtifactSchema),
  apply: z
    .object({
      requires: z.array(z.string()).optional(),
      tracks: z.string().optional(),
      instruction: z.string().optional(),
    })
    .optional(),
})

function parseSchemaYamlInline(content: string): SchemaDetail {
  const raw = parseYaml(content) as unknown
  const parsed = SchemaYamlSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`Invalid schema.yaml: ${parsed.error.message}`)
  }

  const { artifacts, apply, name, description, version } = parsed.data
  const detail: SchemaDetail = {
    name,
    description,
    version,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      outputPath: artifact.generates,
      description: artifact.description,
      template: artifact.template,
      instruction: artifact.instruction,
      requires: artifact.requires ?? [],
    })),
    applyRequires: apply?.requires ?? [],
    applyTracks: apply?.tracks,
    applyInstruction: apply?.instruction,
  }

  const validated = SchemaDetailSchema.safeParse(detail)
  if (!validated.success) {
    throw new Error(`Invalid schema detail: ${validated.error.message}`)
  }

  return validated.data
}
