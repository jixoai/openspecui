import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createWorktreeServerCommand, resolveLocalCliWorkspace } from './worktree-instance-manager'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

async function createWorkspaceFixture(): Promise<{ repoRoot: string; runtimeDir: string }> {
  const repoRoot = await mkdtemp(join(tmpdir(), 'openspecui-worktree-manager-'))
  tempDirs.push(repoRoot)

  await mkdir(join(repoRoot, 'packages', 'cli', 'src'), { recursive: true })
  await writeFile(join(repoRoot, 'package.json'), '{}\n', 'utf8')
  await writeFile(join(repoRoot, 'packages', 'cli', 'package.json'), '{}\n', 'utf8')
  await writeFile(join(repoRoot, 'packages', 'cli', 'src', 'cli.ts'), '// test\n', 'utf8')

  return {
    repoRoot,
    runtimeDir: join(repoRoot, 'packages', 'cli', 'src'),
  }
}

describe('worktree instance manager helpers', () => {
  it('resolves the monorepo workspace from the CLI runtime directory', async () => {
    const fixture = await createWorkspaceFixture()

    expect(resolveLocalCliWorkspace(fixture.runtimeDir)).toEqual({
      repoRoot: fixture.repoRoot,
      cliPackageDir: join(fixture.repoRoot, 'packages', 'cli'),
    })
  })

  it('returns the workspace pnpm command when developing inside the monorepo', async () => {
    const fixture = await createWorkspaceFixture()

    const command = createWorktreeServerCommand({
      runtimeDir: fixture.runtimeDir,
      projectDir: '/tmp/feature-worktree',
      port: 3123,
    })

    expect(command.command).toMatch(/pnpm(?:\.cmd)?$/)
    expect(command.args).toEqual([
      '--filter',
      'openspecui',
      'run',
      'dev',
      '--dir',
      '/tmp/feature-worktree',
      '--port',
      '3123',
      '--no-open',
    ])
    expect(command.cwd).toBe(fixture.repoRoot)
  })

  it('falls back to the packaged cli.mjs entry outside the monorepo', () => {
    const command = createWorktreeServerCommand({
      runtimeDir: '/pkg/runtime',
      projectDir: '/tmp/feature-worktree',
      port: 3123,
    })

    expect(command.command).toBe(process.execPath)
    expect(command.args).toEqual([
      '/pkg/runtime/cli.mjs',
      'start',
      '/tmp/feature-worktree',
      '--port',
      '3123',
      '--no-open',
    ])
    expect(command.cwd).toBe('/tmp/feature-worktree')
  })
})
