import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { join } from 'path'
import { MarkdownParser } from './parser.js'
import { reactiveReadDir, reactiveReadFile, reactiveStat } from './reactive-fs/index.js'
import type { Change, ChangeFile, DeltaSpec, Spec } from './schemas.js'
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
  progress: { total: number; completed: number }
  createdAt: number
  updatedAt: number
}

/** Archived change metadata with time info */
export interface ArchiveMeta {
  id: string
  name: string
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

  /**
   * List changes with metadata (id, name, progress, and time info)
   * Only returns changes that have valid proposal.md
   * Sorted by updatedAt descending (most recent first)
   */
  async listChangesWithMeta(): Promise<ChangeMeta[]> {
    const ids = await this.listChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const change = await this.readChange(id)
        if (!change) return null
        const proposalPath = join(this.changesDir, id, 'proposal.md')
        const timeInfo = await this.getFileTimeInfo(proposalPath)
        return {
          id,
          name: change.name,
          progress: change.progress,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results
      .filter((r): r is ChangeMeta => r !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async listArchivedChanges(): Promise<string[]> {
    return reactiveReadDir(this.archiveDir, { directoriesOnly: true })
  }

  /**
   * List archived changes with metadata and time info
   * Only returns archives that have valid proposal.md
   * Sorted by updatedAt descending (most recent first)
   */
  async listArchivedChangesWithMeta(): Promise<ArchiveMeta[]> {
    const ids = await this.listArchivedChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const change = await this.readArchivedChange(id)
        if (!change) return null
        const proposalPath = join(this.archiveDir, id, 'proposal.md')
        const timeInfo = await this.getFileTimeInfo(proposalPath)
        return {
          id,
          name: change.name,
          createdAt: timeInfo?.createdAt ?? 0,
          updatedAt: timeInfo?.updatedAt ?? 0,
        }
      })
    )
    return results
      .filter((r): r is ArchiveMeta => r !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
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
   * Read AGENTS.md content (reactive)
   */
  async readAgentsMd(): Promise<string | null> {
    const agentsPath = join(this.openspecDir, 'AGENTS.md')
    return reactiveReadFile(agentsPath)
  }

  /**
   * Write project.md content
   */
  async writeProjectMd(content: string): Promise<void> {
    const projectPath = join(this.openspecDir, 'project.md')
    await writeFile(projectPath, content, 'utf-8')
  }

  /**
   * Write AGENTS.md content
   */
  async writeAgentsMd(content: string): Promise<void> {
    const agentsPath = join(this.openspecDir, 'AGENTS.md')
    await writeFile(agentsPath, content, 'utf-8')
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
    const specPath = join(this.specsDir, specId, 'spec.md')
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
    const changeRoot = join(this.changesDir, changeId)
    return this.readFilesUnderRoot(changeRoot)
  }

  async readArchivedChangeFiles(changeId: string): Promise<ChangeFile[]> {
    const archiveRoot = join(this.archiveDir, changeId)
    return this.readFilesUnderRoot(archiveRoot)
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
    const names = await reactiveReadDir(dir, { includeHidden: false })
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
        const content = await reactiveReadFile(fullPath)
        files.push({ path: relativePath, type: 'file', content: content ?? undefined })
      }
    }

    return files
  }

  async readChangeRaw(
    changeId: string
  ): Promise<{ proposal: string; tasks: string; design?: string; deltaSpecs: DeltaSpec[] } | null> {
    const changeDir = join(this.changesDir, changeId)
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
    const archiveChangeDir = join(this.archiveDir, changeId)
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
    const specDir = join(this.specsDir, specId)
    await mkdir(specDir, { recursive: true })
    await writeFile(join(specDir, 'spec.md'), content, 'utf-8')
  }

  async writeChange(changeId: string, proposal: string, tasks?: string): Promise<void> {
    const changeDir = join(this.changesDir, changeId)
    await mkdir(changeDir, { recursive: true })
    await writeFile(join(changeDir, 'proposal.md'), proposal, 'utf-8')
    if (tasks !== undefined) {
      await writeFile(join(changeDir, 'tasks.md'), tasks, 'utf-8')
    }
  }

  // =====================
  // Archive operations
  // =====================

  async archiveChange(changeId: string): Promise<boolean> {
    try {
      const changeDir = join(this.changesDir, changeId)
      const archivePath = join(this.archiveDir, changeId)

      await mkdir(this.archiveDir, { recursive: true })
      await rename(changeDir, archivePath)
      return true
    } catch {
      return false
    }
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

    const agentsMd = `# AI Agent Instructions

This project uses OpenSpec for spec-driven development.

## Available Commands
- \`openspec list\` - List changes or specs
- \`openspec view\` - Dashboard view
- \`openspec show <name>\` - Show change or spec details
- \`openspec validate <name>\` - Validate change or spec
- \`openspec archive <change>\` - Archive completed change

## Workflow
1. Create a change proposal in \`changes/<change-id>/proposal.md\`
2. Define delta specs in \`changes/<change-id>/specs/\`
3. Track tasks in \`changes/<change-id>/tasks.md\`
4. Implement and mark tasks complete
5. Archive when done: \`openspec archive <change-id>\`
`
    await writeFile(join(this.openspecDir, 'AGENTS.md'), agentsMd, 'utf-8')
  }

  // =====================
  // Task operations
  // =====================

  /**
   * Toggle a task's completion status in tasks.md
   * @param changeId - The change ID
   * @param taskIndex - 1-based task index
   * @param completed - New completion status
   */
  async toggleTask(changeId: string, taskIndex: number, completed: boolean): Promise<boolean> {
    try {
      const tasksPath = join(this.changesDir, changeId, 'tasks.md')
      const content = await readFile(tasksPath, 'utf-8')

      const lines = content.split('\n')
      let currentTaskIndex = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Match task lines: - [ ] or - [x] or * [ ] or * [x]
        const taskMatch = line.match(/^([-*]\s+)\[([ xX])\](\s+.*)$/)
        if (taskMatch) {
          currentTaskIndex++
          if (currentTaskIndex === taskIndex) {
            // Update the checkbox
            const prefix = taskMatch[1]
            const suffix = taskMatch[3]
            const newCheckbox = completed ? '[x]' : '[ ]'
            lines[i] = `${prefix}${newCheckbox}${suffix}`
            break
          }
        }
      }

      if (currentTaskIndex < taskIndex) {
        return false // Task not found
      }

      await writeFile(tasksPath, lines.join('\n'), 'utf-8')
      return true
    } catch {
      return false
    }
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
    const totalTasks = validChanges.reduce((sum, c) => sum + c.progress.total, 0)
    const completedTasks = validChanges.reduce((sum, c) => sum + c.progress.completed, 0)

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
