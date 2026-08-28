/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove CLI startServer carries its resolved Web asset root through the real Git worktree handoff.
 * 2. Keep the upstream-owner fixture inside the checked Server transport-test lane.
 * 3. Settle shared watcher owners before removing Windows Git fixtures.
 * 4. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 * 5. Budget the real teardown (production close plus bounded Windows lock retries) per platform
 *    instead of the default hook budget.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-25): "格式问题？md文件有什么格式问题，直接快速处理掉，然后继续工作"
 * Review correction (2026-07-26): downstream Manager fixtures cannot prove the startServer owner transition.
 * Original request (2026-08-28): Windows CI runners started exceeding the 10s default hook budget
 *   during this fixture's real server close and Git-worktree directory removal; the teardown is
 *   real resource release (mirroring SERVER_FIXTURE_TEST_TIMEOUT_MS's platform split), not a race wait.
 */
import { isHostedBackendHealthResponse } from '@openspecui/core'
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, realpath, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { startServer, type RunningServer } from '../../cli/src/index.js'
import { findAvailablePort } from './port-utils.js'
import type { AppRouter } from './router.js'
import { removeServerTestDirectories } from './server-test-cleanup.js'

const runCommand = promisify(execFile)
const servers: RunningServer[] = []
const tempDirs: string[] = []
let nextPreferredPort = 36_300

// Real teardown work: production server close plus bounded Windows lock-release retries over a
// real Git worktree directory. Budget follows the platform, like SERVER_FIXTURE_TEST_TIMEOUT_MS.
const TEARDOWN_HOOK_TIMEOUT_MS = process.platform === 'win32' ? 30_000 : 10_000

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()))
  await removeServerTestDirectories(tempDirs.splice(0))
}, TEARDOWN_HOOK_TIMEOUT_MS)

async function runGit(cwd: string, args: string[]): Promise<void> {
  await runCommand('git', args, { cwd, windowsHide: true })
}

async function createProductChainFixture(): Promise<{
  projectDir: string
  siblingWorktreeDir: string
  webAssetsDir: string
  marker: string
}> {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'openspecui-worktree-assets-product-'))
  tempDirs.push(fixtureDir)
  const projectDir = join(fixtureDir, 'project')
  const siblingWorktreeDir = join(fixtureDir, 'sibling')
  const webAssetsDir = join(fixtureDir, 'runtime-web-assets')
  const marker = 'parent-runtime-worktree-assets'

  await mkdir(join(projectDir, 'openspec'), { recursive: true })
  await mkdir(webAssetsDir)
  await writeFile(join(projectDir, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8')
  await writeFile(join(projectDir, 'README.md'), '# Parent worktree\n', 'utf8')
  await writeFile(
    join(webAssetsDir, 'index.html'),
    `<!doctype html><title>${marker}</title>\n`,
    'utf8'
  )

  await runGit(projectDir, ['init', '--quiet'])
  await runGit(projectDir, ['config', 'user.name', 'OpenSpecUI Test'])
  await runGit(projectDir, ['config', 'user.email', 'openspecui@example.test'])
  await runGit(projectDir, ['add', '.'])
  await runGit(projectDir, ['commit', '--quiet', '-m', 'fixture'])
  await runGit(projectDir, [
    'worktree',
    'add',
    '--quiet',
    '-b',
    'worktree-assets-target',
    siblingWorktreeDir,
  ])

  return { projectDir, siblingWorktreeDir, webAssetsDir, marker }
}

describe('CLI worktree Web asset product chain', () => {
  it('serves the parent runtime asset root after a real Git worktree switch', async () => {
    const fixture = await createProductChainFixture()
    const port = await findAvailablePort(nextPreferredPort, 100)
    nextPreferredPort = port + 1
    const server = await startServer({
      projectDir: fixture.projectDir,
      port,
      enableWatcher: false,
      webAssetsDir: fixture.webAssetsDir,
    })
    servers.push(server)

    const client = createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${server.url}/trpc` })],
    })
    const scopes = await client.git.scopes.query()
    const overview = await client.git.overview.query({
      scope: 'code',
      expectedBindingToken: scopes.code.bindingToken,
    })
    const target = overview.otherWorktrees.find(
      (worktree) => worktree.branchName === 'worktree-assets-target'
    )
    if (!target) throw new Error('Git overview did not expose the sibling worktree.')
    const canonicalSiblingPath = await realpath(fixture.siblingWorktreeDir)

    const handoff = await client.git.switchWorktree.mutate({
      scope: 'code',
      expectedBindingToken: scopes.code.bindingToken,
      path: target.path,
    })
    expect(await realpath(handoff.projectDir)).toBe(canonicalSiblingPath)

    const healthResponse = await fetch(`${handoff.serverUrl}/api/health`)
    const healthPayload: unknown = await healthResponse.json()
    if (!isHostedBackendHealthResponse(healthPayload)) {
      throw new Error('Worktree child returned an invalid health contract.')
    }
    expect(await realpath(healthPayload.projectDir)).toBe(canonicalSiblingPath)

    const shellResponse = await fetch(handoff.serverUrl)
    expect(shellResponse.status).toBe(200)
    expect(await shellResponse.text()).toContain(fixture.marker)
  }, 30_000)
})
