/**
 * Orthogonal intents (updated 2026-07-23 Asia/Shanghai):
 * 1. Read and mutate one CLI-selected planning root through reactive filesystem APIs.
 * 2. Project Specs, Changes, Archives, and schema-neutral entity files.
 * 3. Keep tracked workflow tasks distinct from document checklist analytics.
 * 4. Preserve filesystem provenance and mutation boundaries for server consumers.
 * 5. Expose one bounded Change row projection for progressive list delivery without warming workflow details.
 *
 * Original request (2026-07-15): "Split formal tracked progress, document checklist statistics, and Apply instruction progress into non-interchangeable facts."
 */
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { requireCanonicalOpenSpecEntityId, requireOpenSpecEntityRelativePath } from './entity-id.js'
import { inferFileMime, inferFilePreviewKind, isTextLikeFile } from './file-preview.js'
import {
  buildOpsxEntityDetail,
  getOpsxEntityRootRelativePath,
  parseOpsxEntityMetadata,
  type OpsxEntityDetail,
  type OpsxEntityReadOptions,
  type OpsxEntityStage,
} from './opsx-entity.js'
import { parseOpsxSchemaDetail } from './opsx-schema-detail.js'
import { MarkdownParser } from './parser.js'
import { writePhysicalReactiveFile } from './physical-reactive-file-writer.js'
import { reactiveReadDir, reactiveReadFile, reactiveStat } from './reactive-fs/index.js'
import type { Change, ChangeFile, DeltaSpec, Spec } from './schemas.js'
import {
  projectTaskProjectionsFromMarkdownFiles,
  type DocumentChecklistSummary,
  type TaskProjections,
  type TrackedTaskProgress,
} from './task-progress.js'
import { Validator, type ValidationResult } from './validator.js'

/** Spec metadata with time info */
export interface SpecMeta {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

/** Change metadata with time info */
export interface ChangeMeta {
  id: string
  name: string
  trackedTaskProgress: TrackedTaskProgress
  documentChecklistSummary: DocumentChecklistSummary
  createdAt: number
  updatedAt: number
}

/** Archived change metadata with time info */
export interface ArchiveMeta {
  id: string
  name: string
  trackedTaskProgress: TrackedTaskProgress
  documentChecklistSummary: DocumentChecklistSummary
  createdAt: number
  updatedAt: number
}

/**
 * OpenSpec filesystem adapter
 * Handles reading, writing, and managing OpenSpec files
 */
export class OpenSpecAdapter {
  private parser = new MarkdownParser()
  private validator = new Validator()

  constructor(private projectDir: string) {}

  private get openspecDir() {
    return join(this.projectDir, 'openspec')
  }

  private get specsDir() {
    return join(this.openspecDir, 'specs')
  }

  private get changesDir() {
    return join(this.openspecDir, 'changes')
  }

  private get archiveDir() {
    return join(this.changesDir, 'archive')
  }

  // =====================
  // Existence checks
  // =====================

  async isInitialized(): Promise<boolean> {
    const statInfo = await reactiveStat(this.openspecDir)
    return statInfo?.isDirectory ?? false
  }

  // =====================
  // File time utilities
  // =====================

  /** File time info derived from filesystem (reactive) */
  private async getFileTimeInfo(
    filePath: string
  ): Promise<{ createdAt: number; updatedAt: number } | null> {
    const statInfo = await reactiveStat(filePath)
    if (!statInfo) return null
    return {
      createdAt: statInfo.birthtime,
      updatedAt: statInfo.mtime,
    }
  }

  // =====================
  // List operations
  // =====================

  async listSpecs(): Promise<string[]> {
    return reactiveReadDir(this.specsDir, { directoriesOnly: true })
  }

  /**
   * List specs with metadata (id, name, and time info)
   * Only returns specs that have valid spec.md
   * Sorted by updatedAt descending (most recent first)
   */
  async listSpecsWithMeta(): Promise<SpecMeta[]> {
    const ids = await this.listSpecs()
    const results = await Promise.all(
      ids.map(async (id) => {
        const spec = await this.readSpec(id)
        if (!spec) return null
        const specPath = join(this.specsDir, id, 'spec.md')
        const timeInfo = await this.getFileTimeInfo(specPath)
        return {
          id,
          name: spec.name,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results
      .filter((r): r is SpecMeta => r !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listChanges(): Promise<string[]> {
    return reactiveReadDir(this.changesDir, { directoriesOnly: true, exclude: ['archive'] })
  }

  /** Read one active Change row without resolving workflow Status, Apply, or artifact instructions. */
  async readChangeMeta(id: string): Promise<ChangeMeta> {
    const canonicalId = requireCanonicalOpenSpecEntityId(id, 'changeId')
    const changeDir = join(this.changesDir, canonicalId)
    const [change, taskProjection, timeInfo] = await Promise.all([
      this.readChange(canonicalId),
      this.readChangeTaskProjection(canonicalId),
      this.getFileTimeInfo(changeDir),
    ])
    return {
      id: canonicalId,
      // Legacy parser can be unavailable for custom schemas; keep the change visible with objective fallback metadata.
      name: change?.name ?? canonicalId,
      trackedTaskProgress: taskProjection.trackedTaskProgress,
      documentChecklistSummary: taskProjection.documentChecklistSummary,
      createdAt: timeInfo?.createdAt ?? 0,
      updatedAt: timeInfo?.updatedAt ?? 0,
    }
  }

  /**
   * List changes with metadata, separated task projections, and time info.
   * Returns every change directory, including schema-specific layouts that
   * don't use proposal.md/tasks.md.
   * Sorted by updatedAt descending (most recent first)
   */
  async listChangesWithMeta(): Promise<ChangeMeta[]> {
    const ids = await this.listChanges()
    const results = await Promise.all(ids.map((id) => this.readChangeMeta(id)))
    return results.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listArchivedChanges(): Promise<string[]> {
    return reactiveReadDir(this.archiveDir, { directoriesOnly: true })
  }

  /**
   * List archived changes with metadata and time info
   * Returns every archive directory, including schema-specific layouts that
   * don't use proposal.md/tasks.md.
   * Sorted by updatedAt descending (most recent first)
   */
  async listArchivedChangesWithMeta(): Promise<ArchiveMeta[]> {
    const ids = await this.listArchivedChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const archiveDir = join(this.archiveDir, id)
        const [taskProjection, timeInfo] = await Promise.all([
          this.readArchivedChangeTaskProjection(id),
          this.getFileTimeInfo(archiveDir),
        ])
        return {
          id,
          name: id,
          trackedTaskProgress: taskProjection.trackedTaskProgress,
          documentChecklistSummary: taskProjection.documentChecklistSummary,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  // =====================
  // Project files
  // =====================

  /**
   * Read project.md content (reactive)
   */
  async readProjectMd(): Promise<string | null> {
    const projectPath = join(this.openspecDir, 'project.md')
    return reactiveReadFile(projectPath)
  }

  /**
   * Write project.md content
   */
  async writeProjectMd(content: string): Promise<void> {
    const projectPath = join(this.openspecDir, 'project.md')
    await writeFile(projectPath, content, 'utf-8')
  }

  // =====================
  // Read operations
  // =====================

  async readSpec(specId: string): Promise<Spec | null> {
    try {
      const content = await this.readSpecRaw(specId)
      if (!content) return null
      return this.parser.parseSpec(specId, content)
    } catch {
      return null
    }
  }

  async readSpecRaw(specId: string): Promise<string | null> {
    const canonicalSpecId = requireCanonicalOpenSpecEntityId(specId, 'specId')
    const specPath = join(this.specsDir, canonicalSpecId, 'spec.md')
    return reactiveReadFile(specPath)
  }

  async readChange(changeId: string): Promise<Change | null> {
    try {
      const raw = await this.readChangeRaw(changeId)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal, raw.tasks, {
        design: raw.design,
        deltaSpecs: raw.deltaSpecs,
      })
    } catch {
      return null
    }
  }

  async readChangeFiles(changeId: string): Promise<ChangeFile[]> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const changeRoot = join(this.changesDir, canonicalChangeId)
    return this.readFilesUnderRoot(changeRoot)
  }

  async readArchivedChangeFiles(changeId: string): Promise<ChangeFile[]> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const archiveRoot = join(this.archiveDir, canonicalChangeId)
    return this.readFilesUnderRoot(archiveRoot)
  }

  async readChangeTaskProjection(changeId: string): Promise<TaskProjections> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    return this.readEntityTaskProjection(join(this.changesDir, canonicalChangeId))
  }

  async readArchivedChangeTaskProjection(changeId: string): Promise<TaskProjections> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    return this.readEntityTaskProjection(join(this.archiveDir, canonicalChangeId))
  }

  async readEntityDetail(
    stage: 'change' | 'archive',
    id: string,
    options: OpsxEntityReadOptions = {}
  ): Promise<OpsxEntityDetail | null> {
    const canonicalId = requireCanonicalOpenSpecEntityId(id, 'changeId')
    const root =
      stage === 'change' ? join(this.changesDir, canonicalId) : join(this.archiveDir, canonicalId)
    const files = await this.readFilesUnderRoot(root)
    if (files.length === 0) {
      const statInfo = await reactiveStat(root)
      if (!statInfo?.isDirectory) return null
    }
    return buildOpsxEntityDetail({
      stage,
      id: canonicalId,
      files,
      schemas: options.schemas,
      schemaDiagnostics: options.schemaDiagnostics,
    })
  }

  private async readFilesUnderRoot(root: string): Promise<ChangeFile[]> {
    const rootStat = await reactiveStat(root)
    if (!rootStat?.isDirectory) return []

    const entries = await this.collectChangeFiles(root, root)

    return entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.path.localeCompare(b.path)
    })
  }

  private async collectChangeFiles(root: string, dir: string): Promise<ChangeFile[]> {
    const names = await reactiveReadDir(dir, { includeHidden: true })
    const files: ChangeFile[] = []

    for (const name of names) {
      const fullPath = join(dir, name)
      const statInfo = await reactiveStat(fullPath)
      if (!statInfo) continue

      const relativePath = fullPath.slice(root.length + 1)

      if (statInfo.isDirectory) {
        files.push({ path: relativePath, type: 'directory' })
        files.push(...(await this.collectChangeFiles(root, fullPath)))
      } else {
        const mime = inferFileMime(relativePath) ?? undefined
        const previewKind = inferFilePreviewKind(relativePath, mime)
        const content = isTextLikeFile(relativePath, mime) ? await reactiveReadFile(fullPath) : null
        files.push({ path: relativePath, type: 'file', content: content ?? undefined })
        files[files.length - 1] = {
          ...files[files.length - 1]!,
          mime,
          previewKind,
          size: undefined,
        }
      }
    }

    return files
  }

  private async readProjectSchemaDetail(schemaName: string) {
    const schemaPath = join(this.openspecDir, 'schemas', schemaName, 'schema.yaml')
    const schemaContent = await reactiveReadFile(schemaPath)
    if (!schemaContent) return null
    return parseOpsxSchemaDetail(schemaContent, schemaName, {
      path: `openspec/schemas/${schemaName}/schema.yaml`,
    }).detail
  }

  private async readEntityTaskProjection(root: string): Promise<TaskProjections> {
    const files = await this.readFilesUnderRoot(root)
    const metadataContent =
      files.find((file) => file.type === 'file' && file.path === '.openspec.yaml')?.content ?? null
    const metadata = parseOpsxEntityMetadata(metadataContent)
    const schemaDetail = metadata.schemaName
      ? await this.readProjectSchemaDetail(metadata.schemaName)
      : null

    return projectTaskProjectionsFromMarkdownFiles(files, {
      schemaDetail,
      hasSchemaMetadata: Boolean(metadata.schemaName),
    })
  }

  async readChangeRaw(
    changeId: string
  ): Promise<{ proposal: string; tasks: string; design?: string; deltaSpecs: DeltaSpec[] } | null> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const changeDir = join(this.changesDir, canonicalChangeId)
    const proposalPath = join(changeDir, 'proposal.md')
    const tasksPath = join(changeDir, 'tasks.md')
    const designPath = join(changeDir, 'design.md')
    const specsDir = join(changeDir, 'specs')

    const [proposal, tasks, design] = await Promise.all([
      reactiveReadFile(proposalPath),
      reactiveReadFile(tasksPath),
      reactiveReadFile(designPath),
    ])

    if (!proposal) return null

    // Read delta specs from specs/ directory
    const deltaSpecs = await this.readDeltaSpecs(specsDir)

    return {
      proposal,
      tasks: tasks ?? '',
      design: design ?? undefined,
      deltaSpecs,
    }
  }

  /** Read delta specs from a specs directory */
  private async readDeltaSpecs(specsDir: string): Promise<DeltaSpec[]> {
    const specIds = await reactiveReadDir(specsDir, { directoriesOnly: true })
    const deltaSpecs: DeltaSpec[] = []

    for (const specId of specIds) {
      const specPath = join(specsDir, specId, 'spec.md')
      const content = await reactiveReadFile(specPath)
      if (content) {
        deltaSpecs.push({ specId, content })
      }
    }

    return deltaSpecs
  }

  /**
   * Read an archived change
   */
  async readArchivedChange(changeId: string): Promise<Change | null> {
    try {
      const raw = await this.readArchivedChangeRaw(changeId)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal, raw.tasks, {
        design: raw.design,
        deltaSpecs: raw.deltaSpecs,
      })
    } catch {
      return null
    }
  }

  /**
   * Read raw archived change files (reactive)
   */
  async readArchivedChangeRaw(
    changeId: string
  ): Promise<{ proposal: string; tasks: string; design?: string; deltaSpecs: DeltaSpec[] } | null> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const archiveChangeDir = join(this.archiveDir, canonicalChangeId)
    const proposalPath = join(archiveChangeDir, 'proposal.md')
    const tasksPath = join(archiveChangeDir, 'tasks.md')
    const designPath = join(archiveChangeDir, 'design.md')
    const specsDir = join(archiveChangeDir, 'specs')

    const [proposal, tasks, design] = await Promise.all([
      reactiveReadFile(proposalPath),
      reactiveReadFile(tasksPath),
      reactiveReadFile(designPath),
    ])

    if (!proposal) return null

    // Read delta specs from specs/ directory
    const deltaSpecs = await this.readDeltaSpecs(specsDir)

    return {
      proposal,
      tasks: tasks ?? '',
      design: design ?? undefined,
      deltaSpecs,
    }
  }

  // =====================
  // Write operations
  // =====================

  async writeSpec(specId: string, content: string): Promise<void> {
    const canonicalSpecId = requireCanonicalOpenSpecEntityId(specId, 'specId')
    await writePhysicalReactiveFile({
      rootPath: this.projectDir,
      relativePath: join('openspec', 'specs', canonicalSpecId, 'spec.md'),
      content,
    })
  }

  async writeChange(changeId: string, proposal: string, tasks?: string): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    await writePhysicalReactiveFile({
      rootPath: this.projectDir,
      relativePath: join('openspec', 'changes', canonicalChangeId, 'proposal.md'),
      content: proposal,
    })
    if (tasks !== undefined) {
      await writePhysicalReactiveFile({
        rootPath: this.projectDir,
        relativePath: join('openspec', 'changes', canonicalChangeId, 'tasks.md'),
        content: tasks,
      })
    }
  }

  /** Write one validated Change or Archive entity file through the shared physical/reactive owner. */
  async writeEntityFile(
    stage: OpsxEntityStage,
    changeId: string,
    path: string,
    content: string
  ): Promise<void> {
    const canonicalChangeId = requireCanonicalOpenSpecEntityId(changeId, 'changeId')
    const relativePath = requireOpenSpecEntityRelativePath(path, 'path')
    await writePhysicalReactiveFile({
      rootPath: this.projectDir,
      relativePath: join(getOpsxEntityRootRelativePath(stage, canonicalChangeId), relativePath),
      content,
    })
  }

  // =====================
  // Init operations
  // =====================

  async init(): Promise<void> {
    await mkdir(this.specsDir, { recursive: true })
    await mkdir(this.changesDir, { recursive: true })
    await mkdir(this.archiveDir, { recursive: true })

    const projectMd = `# Project Specification

## Overview
This project uses OpenSpec for spec-driven development.

## Structure
- \`specs/\` - Source of truth specifications
- \`changes/\` - Active change proposals
- \`changes/archive/\` - Completed changes
`
    await writeFile(join(this.openspecDir, 'project.md'), projectMd, 'utf-8')
  }

  // =====================
  // Validation
  // =====================

  async validateSpec(specId: string): Promise<ValidationResult> {
    const spec = await this.readSpec(specId)
    if (!spec) {
      return {
        valid: false,
        issues: [{ severity: 'ERROR', message: `Spec '${specId}' not found` }],
      }
    }
    return this.validator.validateSpec(spec)
  }

  async validateChange(changeId: string): Promise<ValidationResult> {
    const change = await this.readChange(changeId)
    if (!change) {
      return {
        valid: false,
        issues: [{ severity: 'ERROR', message: `Change '${changeId}' not found` }],
      }
    }
    return this.validator.validateChange(change)
  }

  // =====================
  // Dashboard data
  // =====================

  async getDashboardData() {
    const [specIds, changeIds, archivedIds] = await Promise.all([
      this.listSpecs(),
      this.listChanges(),
      this.listArchivedChanges(),
    ])

    const specs = await Promise.all(specIds.map((id) => this.readSpec(id)))
    const changes = await Promise.all(changeIds.map((id) => this.readChange(id)))

    const validSpecs = specs.filter((s): s is Spec => s !== null)
    const validChanges = changes.filter((c): c is Change => c !== null)

    const totalRequirements = validSpecs.reduce((sum, s) => sum + s.requirements.length, 0)
    const totalTasks = validChanges.reduce(
      (sum, change) => sum + change.trackedTaskProgress.total,
      0
    )
    const completedTasks = validChanges.reduce(
      (sum, change) => sum + change.trackedTaskProgress.completed,
      0
    )

    return {
      specs: validSpecs,
      changes: validChanges,
      archivedCount: archivedIds.length,
      summary: {
        specCount: validSpecs.length,
        requirementCount: totalRequirements,
        activeChangeCount: validChanges.length,
        archivedChangeCount: archivedIds.length,
        totalTasks,
        completedTasks,
        progressPercent: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      },
    }
  }
}
