/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Mutate only a task present in the current tracked-artifact projection.
 * 2. Resolve the physical task file inside the selected Planning-root Change.
 * 3. Refresh reactive file state immediately after the guarded write.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 */
import {
  reactiveReadFile,
  toggleMarkdownTask,
  updateReactiveFileCache,
  type OpenSpecAdapter,
  type TrackedTaskLocation,
} from '@openspecui/core'
import { writeFile } from 'node:fs/promises'
import { resolveEntityEntryPath } from './entity-file-paths.js'

export interface SetTrackedTaskCompletionOptions {
  adapter: OpenSpecAdapter
  projectDir: string
  changeId: string
  location: TrackedTaskLocation
  completed: boolean
}

/** Set one tracked checkbox and synchronously invalidate its reactive file projection. */
export async function setTrackedTaskCompletion(
  options: SetTrackedTaskCompletionOptions
): Promise<void> {
  const info = resolveEntityEntryPath({
    projectDir: options.projectDir,
    stage: 'change',
    changeId: options.changeId,
    path: options.location.filePath,
  })
  const projection = await options.adapter.readChangeTaskProjection(options.changeId)
  const trackedTask = projection.trackedTaskProgress.tasks.find(
    (task) =>
      task.location.filePath === info.relativePath &&
      task.location.taskIndex === options.location.taskIndex
  )
  if (!trackedTask) {
    throw new Error('Task location is not part of the current tracked artifact projection.')
  }

  const content = await reactiveReadFile(info.absolutePath)
  if (content === null) {
    throw new Error(`Tracked task file no longer exists: ${info.relativePath}`)
  }
  const updated = toggleMarkdownTask(content, options.location.taskIndex, options.completed)
  if (updated === null) {
    throw new Error(`Failed to toggle task ${options.location.taskIndex} in ${info.relativePath}`)
  }

  await writeFile(info.absolutePath, updated, 'utf8')
  updateReactiveFileCache(info.absolutePath, updated)
}
