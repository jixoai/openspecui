/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove task mutation targets the exact tracked Markdown file.
 * 2. Prove reactive task projections refresh immediately after mutation.
 * 3. Prove unrelated Markdown cannot be selected as formal task truth.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 */
import { OpenSpecAdapter, ReactiveContext, clearCache, closeAllWatchers } from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { setTrackedTaskCompletion } from './tracked-task-mutation.js'

const tempDirs: string[] = []

afterEach(async () => {
  clearCache()
  await closeAllWatchers()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('setTrackedTaskCompletion', () => {
  it('refreshes the exact tracked-file projection immediately after write', async () => {
    const projectDir = await mkdtemp(join(tmpdir(), 'openspecui-tracked-task-mutation-'))
    tempDirs.push(projectDir)
    const changeDir = join(projectDir, 'openspec', 'changes', 'mutation-demo')
    const taskPath = join(changeDir, 'work', 'backend', 'tasks.md')
    await Promise.all([
      mkdir(join(changeDir, 'work', 'backend'), { recursive: true }),
      mkdir(join(projectDir, 'openspec', 'schemas', 'vision-driven'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(changeDir, '.openspec.yaml'), 'schema: vision-driven\n', 'utf8'),
      writeFile(taskPath, '- [ ] Backend\n- [ ] Backend follow-up\n', 'utf8'),
      writeFile(join(changeDir, 'notes.md'), '- [ ] Not tracked\n', 'utf8'),
      writeFile(
        join(projectDir, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
        `name: vision-driven
artifacts:
  - id: work
    generates: work/**/*.md
apply:
  tracks: work/**/*.md
`,
        'utf8'
      ),
    ])

    const adapter = new OpenSpecAdapter(projectDir)
    const context = new ReactiveContext()
    const projectionStream = context.stream(() => adapter.readChangeTaskProjection('mutation-demo'))
    const initial = await projectionStream.next()
    expect(initial.value.trackedTaskProgress.completed).toBe(0)

    const refreshedProjection = projectionStream.next()
    await setTrackedTaskCompletion({
      adapter,
      projectDir,
      changeId: 'mutation-demo',
      location: { filePath: 'work/backend/tasks.md', taskIndex: 2 },
      completed: true,
    })

    await expect(refreshedProjection).resolves.toMatchObject({
      value: {
        trackedTaskProgress: {
          completed: 1,
          tasks: [
            { completed: false, location: { filePath: 'work/backend/tasks.md', taskIndex: 1 } },
            { completed: true, location: { filePath: 'work/backend/tasks.md', taskIndex: 2 } },
          ],
        },
      },
    })
    await expect(readFile(taskPath, 'utf8')).resolves.toBe(
      '- [ ] Backend\n- [x] Backend follow-up\n'
    )
    await expect(
      setTrackedTaskCompletion({
        adapter,
        projectDir,
        changeId: 'mutation-demo',
        location: { filePath: 'notes.md', taskIndex: 1 },
        completed: true,
      })
    ).rejects.toThrow(/not part of the current tracked artifact projection/i)

    await projectionStream.return(undefined)
  })
})
