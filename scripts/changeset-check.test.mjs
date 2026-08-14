/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Prove private package changes do not require a release changeset.
 * 2. Keep the Git and Node integration fixture bounded on slower Windows filesystems.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const tempDirs = []
const scriptSource = resolve(dirname(fileURLToPath(import.meta.url)), 'changeset-check.mjs')

function createRepoFixture() {
  const rootDir = mkdtempSync(join(tmpdir(), 'openspecui-changeset-check-'))
  tempDirs.push(rootDir)
  mkdirSync(join(rootDir, 'packages', 'local-translator'), { recursive: true })
  mkdirSync(join(rootDir, 'packages', 'server'), { recursive: true })
  writeFileSync(
    join(rootDir, 'packages', 'local-translator', 'package.json'),
    JSON.stringify(
      {
        name: '@openspecui/local-translator',
        private: true,
        version: '1.0.0',
      },
      null,
      2
    )
  )
  writeFileSync(
    join(rootDir, 'packages', 'server', 'package.json'),
    JSON.stringify(
      {
        name: '@openspecui/server',
        version: '1.0.0',
      },
      null,
      2
    )
  )
  const scriptTarget = join(rootDir, 'scripts', 'changeset-check.mjs')
  mkdirSync(dirname(scriptTarget), { recursive: true })
  writeFileSync(scriptTarget, readFileSync(scriptSource, 'utf8'))
  spawnSync('git', ['init'], { cwd: rootDir, stdio: 'ignore', windowsHide: true })
  spawnSync('git', ['config', 'user.email', 'codex@example.com'], {
    cwd: rootDir,
    stdio: 'ignore',
    windowsHide: true,
  })
  spawnSync('git', ['config', 'user.name', 'Codex'], {
    cwd: rootDir,
    stdio: 'ignore',
    windowsHide: true,
  })
  spawnSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore', windowsHide: true })
  spawnSync('git', ['commit', '-m', 'init'], { cwd: rootDir, stdio: 'ignore', windowsHide: true })
  const baseSha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: rootDir,
    encoding: 'utf8',
    windowsHide: true,
  }).stdout.trim()
  return { baseSha, rootDir }
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('changeset-check', () => {
  it('ignores private package changes when checking for releasable package changes', () => {
    const { rootDir, baseSha } = createRepoFixture()
    writeFileSync(join(rootDir, 'packages', 'local-translator', 'src.ts'), 'export const x = 1\n')
    spawnSync('git', ['add', '.'], { cwd: rootDir, stdio: 'ignore', windowsHide: true })

    const result = spawnSync(process.execPath, ['scripts/changeset-check.mjs'], {
      cwd: rootDir,
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        CHANGESET_CHECK_BASE_SHA: baseSha,
      },
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('No release-affecting changes under packages/.')
  }, 15_000)
})
