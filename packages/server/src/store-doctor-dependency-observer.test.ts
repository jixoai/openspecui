/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Prove non-Git Doctor observation ignores unrelated content but tracks structure and Store metadata.
 * 2. Prove Git Doctor observation tracks working-tree state and exact local Git metadata facts.
 * 3. Prove linked-worktree gitdir/commondir dependencies remain observable outside the Store root.
 *
 * Original request (2026-07-26): "真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createStoreDoctorDependencyObservation } from './store-doctor-dependency-observer.js'

const tempDirs: string[] = []

async function createRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

async function waitForWatcher(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 150))
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('Store Doctor dependency observation', () => {
  it('ignores unrelated non-Git content and config bytes while tracking Store metadata', async () => {
    const root = await createRoot('openspecui-doctor-non-git-')
    await Promise.all([
      mkdir(join(root, 'openspec', 'specs'), { recursive: true }),
      mkdir(join(root, 'openspec', 'changes', 'archive'), { recursive: true }),
      mkdir(join(root, '.openspec-store'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(root, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8'),
      writeFile(join(root, '.openspec-store', 'store.yaml'), 'id: team\n', 'utf8'),
    ])
    const onChange = vi.fn()
    const observer = await createStoreDoctorDependencyObservation({ rootPath: root, onChange })

    try {
      await writeFile(join(root, 'unrelated.md'), '# unrelated\n', 'utf8')
      await waitForWatcher()
      expect(onChange).not.toHaveBeenCalled()

      await writeFile(join(root, 'openspec', 'config.yaml'), 'schema: custom\n', 'utf8')
      await waitForWatcher()
      expect(onChange).not.toHaveBeenCalled()

      await writeFile(
        join(root, '.openspec-store', 'store.yaml'),
        'id: team\nremote: ssh://example/team.git\n',
        'utf8'
      )
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    } finally {
      await observer.dispose()
    }
  })

  it('tracks Git worktree, index, HEAD, config, and refs facts', async () => {
    const root = await createRoot('openspecui-doctor-git-')
    const gitDir = join(root, '.git')
    await mkdir(join(gitDir, 'refs', 'heads'), { recursive: true })
    await Promise.all([
      writeFile(join(gitDir, 'HEAD'), 'ref: refs/heads/main\n', 'utf8'),
      writeFile(join(gitDir, 'index'), 'index-a', 'utf8'),
      writeFile(join(gitDir, 'config'), '[remote "origin"]\nurl = a\n', 'utf8'),
    ])
    const onChange = vi.fn()
    const observer = await createStoreDoctorDependencyObservation({ rootPath: root, onChange })

    try {
      await waitForWatcher()
      await writeFile(join(root, 'working.md'), '# dirty\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
      await writeFile(join(gitDir, 'index'), 'index-b', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
      await writeFile(join(gitDir, 'HEAD'), 'ref: refs/heads/next\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(3))
      await writeFile(join(gitDir, 'config'), '[remote "origin"]\nurl = b\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(4))
      await writeFile(join(gitDir, 'refs', 'heads', 'next'), 'abc123\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(5))
    } finally {
      await observer.dispose()
    }
  })

  it('tracks linked-worktree gitdir and common-dir facts outside the Store root', async () => {
    const root = await createRoot('openspecui-doctor-worktree-')
    const commonDir = await createRoot('openspecui-doctor-common-git-')
    const gitDir = join(commonDir, 'worktrees', 'team')
    await mkdir(gitDir, { recursive: true })
    await mkdir(join(commonDir, 'refs', 'heads'), { recursive: true })
    await Promise.all([
      writeFile(join(root, '.git'), `gitdir: ${gitDir}\n`, 'utf8'),
      writeFile(join(gitDir, 'commondir'), '../..\n', 'utf8'),
      writeFile(join(gitDir, 'HEAD'), 'ref: refs/heads/main\n', 'utf8'),
      writeFile(join(gitDir, 'index'), 'index-a', 'utf8'),
      writeFile(join(commonDir, 'config'), '[remote "origin"]\nurl = a\n', 'utf8'),
    ])
    const onChange = vi.fn()
    const observer = await createStoreDoctorDependencyObservation({ rootPath: root, onChange })

    try {
      await waitForWatcher()
      await writeFile(join(gitDir, 'index'), 'index-b', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
      await writeFile(join(commonDir, 'config'), '[remote "origin"]\nurl = b\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(2))
      await writeFile(join(commonDir, 'refs', 'heads', 'main'), 'abc123\n', 'utf8')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(3))
    } finally {
      await observer.dispose()
    }
  })
})
