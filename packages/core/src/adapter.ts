import { readdir, readFile, stat, mkdir, writeFile, rename } from 'fs/promises'
import { join } from 'path'
import { MarkdownParser } from './parser.js'
import { Validator, type ValidationResult } from './validator.js'
import type { Spec, Change } from './schemas.js'

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
    try {
      const openspecStat = await stat(this.openspecDir)
      return openspecStat.isDirectory()
    } catch {
      return false
    }
  }

  // =====================
  // List operations
  // =====================

  async listSpecs(): Promise<string[]> {
    try {
      const entries = await readdir(this.specsDir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    } catch {
      return []
    }
  }

  /**
   * List specs with metadata (id and name)
   */
  async listSpecsWithMeta(): Promise<Array<{ id: string; name: string }>> {
    const ids = await this.listSpecs()
    const results = await Promise.all(
      ids.map(async (id) => {
        const spec = await this.readSpec(id)
        return { id, name: spec?.name ?? id }
      })
    )
    return results
  }

  async listChanges(): Promise<string[]> {
    try {
      const entries = await readdir(this.changesDir, { withFileTypes: true })
      return entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'archive')
        .map((e) => e.name)
    } catch {
      return []
    }
  }

  /**
   * List changes with metadata (id, name, and progress)
   */
  async listChangesWithMeta(): Promise<
    Array<{ id: string; name: string; progress: { total: number; completed: number } }>
  > {
    const ids = await this.listChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const change = await this.readChange(id)
        return {
          id,
          name: change?.name ?? id,
          progress: change?.progress ?? { total: 0, completed: 0 },
        }
      })
    )
    return results
  }

  async listArchivedChanges(): Promise<string[]> {
    try {
      const entries = await readdir(this.archiveDir, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name)
    } catch {
      return []
    }
  }

  /**
   * List archived changes with metadata
   */
  async listArchivedChangesWithMeta(): Promise<Array<{ id: string; name: string }>> {
    const ids = await this.listArchivedChanges()
    const results = await Promise.all(
      ids.map(async (id) => {
        const change = await this.readArchivedChange(id)
        return { id, name: change?.name ?? id }
      })
    )
    return results
  }

  // =====================
  // Project files
  // =====================

  /**
   * Read project.md content
   */
  async readProjectMd(): Promise<string | null> {
    try {
      const projectPath = join(this.openspecDir, 'project.md')
      return await readFile(projectPath, 'utf-8')
    } catch {
      return null
    }
  }

  /**
   * Read AGENTS.md content
   */
  async readAgentsMd(): Promise<string | null> {
    try {
      const agentsPath = join(this.openspecDir, 'AGENTS.md')
      return await readFile(agentsPath, 'utf-8')
    } catch {
      return null
    }
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
    try {
      const specPath = join(this.specsDir, specId, 'spec.md')
      return await readFile(specPath, 'utf-8')
    } catch {
      return null
    }
  }

  async readChange(changeId: string): Promise<Change | null> {
    try {
      const raw = await this.readChangeRaw(changeId)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal, raw.tasks)
    } catch {
      return null
    }
  }

  async readChangeRaw(changeId: string): Promise<{ proposal: string; tasks: string } | null> {
    try {
      const proposalPath = join(this.changesDir, changeId, 'proposal.md')
      const tasksPath = join(this.changesDir, changeId, 'tasks.md')

      const [proposal, tasks] = await Promise.all([
        readFile(proposalPath, 'utf-8'),
        readFile(tasksPath, 'utf-8').catch(() => ''),
      ])

      return { proposal, tasks }
    } catch {
      return null
    }
  }

  /**
   * Read an archived change
   */
  async readArchivedChange(changeId: string): Promise<Change | null> {
    try {
      const raw = await this.readArchivedChangeRaw(changeId)
      if (!raw) return null
      return this.parser.parseChange(changeId, raw.proposal, raw.tasks)
    } catch {
      return null
    }
  }

  /**
   * Read raw archived change files
   */
  async readArchivedChangeRaw(changeId: string): Promise<{ proposal: string; tasks: string } | null> {
    try {
      const proposalPath = join(this.archiveDir, changeId, 'proposal.md')
      const tasksPath = join(this.archiveDir, changeId, 'tasks.md')

      const [proposal, tasks] = await Promise.all([
        readFile(proposalPath, 'utf-8'),
        readFile(tasksPath, 'utf-8').catch(() => ''),
      ])

      return { proposal, tasks }
    } catch {
      return null
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
