/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Project OpenSpec's tracked artifact glob as the only workflow task truth.
 * 2. Preserve schema-document checklists as grouped secondary analytics.
 * 3. Attribute raw Apply instruction counts without normalizing tracked divergence.
 * 4. Parse Markdown checkbox tasks once without exposing a generic progress alias.
 * 5. Attach mutation-safe file identity to every tracked task.
 *
 * Original request (2026-07-15): "统计信息仍然有一定的间接价值。"
 */
import { opsxPathMatchesPattern } from './opsx-entity.js'
import type { SchemaArtifact, SchemaDetail } from './opsx-types.js'
import type { ChangeFile, Task } from './schemas.js'

export type TrackedTaskPhase = 'no-tasks' | 'in-progress' | 'complete'

/** Exact tracked Markdown checkbox location used for a guarded mutation. */
export interface TrackedTaskLocation {
  filePath: string
  taskIndex: number
}

/** Formal tracked task with its physical source identity. */
export interface TrackedTask extends Task {
  location: TrackedTaskLocation
}

export type TrackedTaskSource =
  | {
      kind: 'artifact'
      artifactId: string
      outputPath: string
      filePaths: string[]
    }
  | {
      kind: 'top-level-fallback'
      artifactId: null
      outputPath: 'tasks.md'
      filePaths: ['tasks.md']
    }
  | {
      kind: 'none'
      artifactId: null
      outputPath: null
      filePaths: []
    }

/** Formal workflow task truth resolved from the OpenSpec tracked artifact. */
export interface TrackedTaskProgress {
  tasks: TrackedTask[]
  total: number
  completed: number
  remaining: number
  phase: TrackedTaskPhase
  source: TrackedTaskSource
}

/** One physical schema document, counted once even when artifact globs overlap. */
export interface DocumentChecklistGroup {
  artifactIds: string[]
  filePath: string
  tasks: Task[]
  total: number
  completed: number
  remaining: number
}

/** Secondary checklist analytics. This type intentionally has no workflow phase. */
export interface DocumentChecklistSummary {
  groups: DocumentChecklistGroup[]
  total: number
  completed: number
  remaining: number
}

export type ApplyInstructionState = 'blocked' | 'all_done' | 'ready'

export interface ApplyInstructionDivergence {
  kind: 'tracked-task-mismatch'
  message: string
  apply: {
    total: number
    complete: number
    remaining: number
  }
  tracked: {
    total: number
    completed: number
    remaining: number
    phase: TrackedTaskPhase
  }
}

/** Raw OpenSpec Apply progress with explicit source and tracked-task comparison. */
export interface ApplyInstructionProgress {
  source: 'openspec-instructions-apply'
  total: number
  complete: number
  remaining: number
  state: ApplyInstructionState
  divergence: ApplyInstructionDivergence | null
}

export interface TaskProjections {
  trackedTaskProgress: TrackedTaskProgress
  documentChecklistSummary: DocumentChecklistSummary
}

export interface TaskProjectionOptions {
  schemaDetail?: SchemaDetail | null
  hasSchemaMetadata?: boolean
}

interface TextTaskSource {
  path: string
  content: string
}

const CHECKBOX_TASK_LINE = /^\s*[-*]\s+\[([ xX])\]\s+(.+)$/
const MARKDOWN_FILE_PATH = /\.(?:md|markdown)$/i

export function isMarkdownTaskSourcePath(path: string): boolean {
  return MARKDOWN_FILE_PATH.test(path)
}

export function parseMarkdownTasks(
  content: string,
  options: { initialIndex?: number } = {}
): Task[] {
  const tasks: Task[] = []
  const lines = content.split('\n')
  let currentSection = ''
  let taskIndex = options.initialIndex ?? 0

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,6}\s+(.+)$/)
    if (headingMatch) {
      currentSection = headingMatch[1].trim()
      continue
    }

    const taskMatch = line.match(CHECKBOX_TASK_LINE)
    if (!taskMatch) continue

    taskIndex += 1
    tasks.push({
      id: `task-${taskIndex}`,
      text: taskMatch[2].trim(),
      completed: taskMatch[1].toLowerCase() === 'x',
      section: currentSection || undefined,
    })
  }

  return tasks
}

export function deriveTrackedTaskPhase(total: number, completed: number): TrackedTaskPhase {
  if (total === 0) return 'no-tasks'
  return completed >= total ? 'complete' : 'in-progress'
}

export function createTrackedTaskProgress(
  tasks: TrackedTask[],
  source: TrackedTaskSource = {
    kind: 'none',
    artifactId: null,
    outputPath: null,
    filePaths: [],
  }
): TrackedTaskProgress {
  const total = tasks.length
  const completed = tasks.filter((task) => task.completed).length
  return {
    tasks,
    total,
    completed,
    remaining: total - completed,
    phase: deriveTrackedTaskPhase(total, completed),
    source,
  }
}

export function createDocumentChecklistSummary(
  groups: DocumentChecklistGroup[]
): DocumentChecklistSummary {
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const completed = groups.reduce((sum, group) => sum + group.completed, 0)
  return { groups, total, completed, remaining: total - completed }
}

export function createApplyInstructionProgress(
  input: {
    total: number
    complete: number
    remaining: number
    state: ApplyInstructionState
  },
  trackedTaskProgress?: TrackedTaskProgress | null
): ApplyInstructionProgress {
  const differs =
    trackedTaskProgress !== undefined &&
    trackedTaskProgress !== null &&
    (input.total !== trackedTaskProgress.total ||
      input.complete !== trackedTaskProgress.completed ||
      input.remaining !== trackedTaskProgress.remaining)

  return {
    source: 'openspec-instructions-apply',
    total: input.total,
    complete: input.complete,
    remaining: input.remaining,
    state: input.state,
    divergence: differs
      ? {
          kind: 'tracked-task-mismatch',
          message:
            'OpenSpec Apply instruction progress differs from the tracked artifact glob projection.',
          apply: {
            total: input.total,
            complete: input.complete,
            remaining: input.remaining,
          },
          tracked: {
            total: trackedTaskProgress.total,
            completed: trackedTaskProgress.completed,
            remaining: trackedTaskProgress.remaining,
            phase: trackedTaskProgress.phase,
          },
        }
      : null,
  }
}

function getTextFiles(files: readonly ChangeFile[]): TextTaskSource[] {
  return files
    .filter(
      (file): file is ChangeFile & { type: 'file'; content: string } =>
        file.type === 'file' && typeof file.content === 'string'
    )
    .map((file) => ({ path: file.path, content: file.content }))
    .sort((left, right) => left.path.localeCompare(right.path))
}

function getTrackedArtifact(schemaDetail: SchemaDetail | null | undefined): SchemaArtifact | null {
  if (!schemaDetail) return null
  if (schemaDetail.applyTracks) {
    return (
      schemaDetail.artifacts.find((artifact) => artifact.outputPath === schemaDetail.applyTracks) ??
      null
    )
  }
  return schemaDetail.artifacts.find((artifact) => artifact.id === 'tasks') ?? null
}

function selectTrackedSources(
  textFiles: readonly TextTaskSource[],
  schemaDetail: SchemaDetail | null | undefined
): { sources: TextTaskSource[]; source: TrackedTaskSource } {
  const trackedArtifact = getTrackedArtifact(schemaDetail)
  if (trackedArtifact) {
    const sources = textFiles.filter((file) =>
      opsxPathMatchesPattern(file.path, trackedArtifact.outputPath)
    )
    if (sources.length > 0) {
      return {
        sources,
        source: {
          kind: 'artifact',
          artifactId: trackedArtifact.id,
          outputPath: trackedArtifact.outputPath,
          filePaths: sources.map((source) => source.path),
        },
      }
    }
  }

  const fallback = textFiles.find((file) => file.path === 'tasks.md')
  if (fallback) {
    return {
      sources: [fallback],
      source: {
        kind: 'top-level-fallback',
        artifactId: null,
        outputPath: 'tasks.md',
        filePaths: ['tasks.md'],
      },
    }
  }

  return {
    sources: [],
    source: { kind: 'none', artifactId: null, outputPath: null, filePaths: [] },
  }
}

function parseSources(sources: readonly TextTaskSource[]): TrackedTask[] {
  const tasks: TrackedTask[] = []
  for (const source of sources) {
    const sourceTasks = parseMarkdownTasks(source.content, { initialIndex: tasks.length })
    tasks.push(
      ...sourceTasks.map((task, index) => ({
        ...task,
        location: { filePath: source.path, taskIndex: index + 1 },
      }))
    )
  }
  return tasks
}

/** Toggle one checkbox by its 1-based index while preserving the surrounding Markdown. */
export function toggleMarkdownTask(
  content: string,
  taskIndex: number,
  completed: boolean
): string | null {
  if (!Number.isInteger(taskIndex) || taskIndex < 1) return null

  const lines = content.split('\n')
  let currentTaskIndex = 0
  for (let index = 0; index < lines.length; index += 1) {
    const taskMatch = /^(\s*[-*]\s+)\[([ xX])\](\s+.*)$/.exec(lines[index])
    if (!taskMatch) continue
    currentTaskIndex += 1
    if (currentTaskIndex !== taskIndex) continue

    lines[index] = `${taskMatch[1]}[${completed ? 'x' : ' '}]${taskMatch[3]}`
    return lines.join('\n')
  }
  return null
}

function selectDocumentSources(
  textFiles: readonly TextTaskSource[],
  options: TaskProjectionOptions
): Array<{ source: TextTaskSource; artifactIds: string[] }> {
  const markdownFiles = textFiles.filter((file) => isMarkdownTaskSourcePath(file.path))
  if (options.schemaDetail) {
    return markdownFiles.flatMap((source) => {
      const artifactIds = options
        .schemaDetail!.artifacts.filter((artifact) =>
          opsxPathMatchesPattern(source.path, artifact.outputPath)
        )
        .map((artifact) => artifact.id)
      return artifactIds.length > 0 ? [{ source, artifactIds }] : []
    })
  }

  if (options.hasSchemaMetadata) {
    return markdownFiles.map((source) => ({ source, artifactIds: [] }))
  }

  return markdownFiles
    .filter((source) => source.path === 'tasks.md')
    .map((source) => ({ source, artifactIds: [] }))
}

function projectDocumentChecklistSummary(
  textFiles: readonly TextTaskSource[],
  options: TaskProjectionOptions
): DocumentChecklistSummary {
  let taskIndex = 0
  const groups = selectDocumentSources(textFiles, options).map(({ source, artifactIds }) => {
    const tasks = parseMarkdownTasks(source.content, { initialIndex: taskIndex })
    taskIndex += tasks.length
    const completed = tasks.filter((task) => task.completed).length
    return {
      artifactIds,
      filePath: source.path,
      tasks,
      total: tasks.length,
      completed,
      remaining: tasks.length - completed,
    }
  })
  return createDocumentChecklistSummary(groups)
}

export function projectTaskProjectionsFromMarkdownFiles(
  files: readonly ChangeFile[],
  options: TaskProjectionOptions = {}
): TaskProjections {
  const textFiles = getTextFiles(files)
  const tracked = selectTrackedSources(textFiles, options.schemaDetail)

  return {
    trackedTaskProgress: createTrackedTaskProgress(parseSources(tracked.sources), tracked.source),
    documentChecklistSummary: projectDocumentChecklistSummary(textFiles, options),
  }
}
