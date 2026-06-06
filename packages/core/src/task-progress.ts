import { opsxPathMatchesPattern } from './opsx-entity.js'
import type { SchemaDetail } from './opsx-types.js'
import type { ChangeFile, Task } from './schemas.js'

export interface TaskProgress {
  total: number
  completed: number
}

export interface TaskProjection {
  tasks: Task[]
  progress: TaskProgress
}

export interface TaskProjectionOptions {
  schemaDetail?: SchemaDetail | null
  hasSchemaMetadata?: boolean
}

interface MarkdownTaskSource {
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

export function computeTaskProgress(tasks: readonly Pick<Task, 'completed'>[]): TaskProgress {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.completed).length,
  }
}

function getSchemaTaskPatterns(schemaDetail: SchemaDetail | null | undefined): string[] {
  if (!schemaDetail) return []
  const patterns = [
    ...schemaDetail.artifacts.map((artifact) => artifact.outputPath),
    schemaDetail.applyTracks,
  ].filter((pattern): pattern is string => typeof pattern === 'string' && pattern.trim().length > 0)
  return [...new Set(patterns)]
}

function selectTaskSources(
  files: readonly ChangeFile[],
  options: TaskProjectionOptions
): MarkdownTaskSource[] {
  const markdownFiles = files.filter(
    (file): file is ChangeFile & { type: 'file'; content: string } =>
      file.type === 'file' &&
      typeof file.content === 'string' &&
      isMarkdownTaskSourcePath(file.path)
  )

  const schemaPatterns = getSchemaTaskPatterns(options.schemaDetail)
  if (schemaPatterns.length > 0) {
    return markdownFiles
      .filter((file) =>
        schemaPatterns.some((pattern) => opsxPathMatchesPattern(file.path, pattern))
      )
      .map((file) => ({ path: file.path, content: file.content }))
  }

  if (options.hasSchemaMetadata) {
    return markdownFiles.map((file) => ({ path: file.path, content: file.content }))
  }

  return markdownFiles
    .filter((file) => file.path === 'tasks.md')
    .map((file) => ({ path: file.path, content: file.content }))
}

export function projectTasksFromMarkdownFiles(
  files: readonly ChangeFile[],
  options: TaskProjectionOptions = {}
): TaskProjection {
  const sources = selectTaskSources(files, options)
  const tasks: Task[] = []
  for (const source of sources) {
    tasks.push(...parseMarkdownTasks(source.content, { initialIndex: tasks.length }))
  }

  return {
    tasks,
    progress: computeTaskProgress(tasks),
  }
}
