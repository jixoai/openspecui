/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prepare and remove fixed disposable Workspaces/Stores visual-review fixtures.
 * 2. Expose exact build, App start, and foreground backend commands without hiding process ownership.
 * 3. Refuse destructive cleanup outside the script-owned absolute /tmp paths.
 *
 * Original request (2026-07-31): "顺便准备一些必要的脚本方便我完成走查工作"
 */
import { $ } from 'bun'
import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const REPO_ROOT = resolve(import.meta.dir, '..')
const OWNER_HOME = '/tmp/openspecui-owner-home'
const ALIAS_ROOT = '/tmp/openspecui-owner-alias'
const ALIAS_PROJECT = `${ALIAS_ROOT}/openspecui`
const MANUAL_HOME = '/tmp/openspecui-owner-manual-home'
const ENV_A = '/tmp/openspecui-owner-env-a'
const ENV_B = '/tmp/openspecui-owner-env-b'
const STORE_A = '/tmp/openspecui-owner-store-a'
const STORE_B = '/tmp/openspecui-owner-store-b'

const DISPOSABLE_PATHS = [OWNER_HOME, ALIAS_ROOT, MANUAL_HOME, ENV_A, ENV_B, STORE_A, STORE_B]

async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false
    throw error
  }
}

async function assertCleanFixturePaths(): Promise<void> {
  const occupied: string[] = []
  for (const path of DISPOSABLE_PATHS) {
    if (await pathExists(path)) occupied.push(path)
  }
  if (occupied.length > 0) {
    throw new Error(
      `Fixture paths already exist. Inspect or run cleanup first:\n${occupied.join('\n')}`
    )
  }
}

async function setup(): Promise<void> {
  await assertCleanFixturePaths()
  await mkdir(OWNER_HOME, { recursive: true })
  await mkdir(ALIAS_ROOT, { recursive: true })
  await symlink(REPO_ROOT, ALIAS_PROJECT)
  console.log(`Prepared:\n- ${OWNER_HOME}\n- ${ALIAS_PROJECT} -> ${REPO_ROOT}`)
}

async function setupStores(): Promise<void> {
  for (const path of [ENV_A, ENV_B, STORE_A, STORE_B]) {
    if (await pathExists(path))
      throw new Error(`Refusing to replace existing fixture path: ${path}`)
  }
  await $`env XDG_DATA_HOME=${ENV_A} node ${REPO_ROOT}/references/openspec/bin/openspec.js store setup shared --path ${STORE_A} --no-init-git --json`.cwd(
    REPO_ROOT
  )
  await $`env XDG_DATA_HOME=${ENV_B} node ${REPO_ROOT}/references/openspec/bin/openspec.js store setup shared --path ${STORE_B} --no-init-git --json`.cwd(
    REPO_ROOT
  )
}

async function cleanup(): Promise<void> {
  await $`env OPENSPECUI_HOME=${OWNER_HOME} pnpm openspecui stop`.cwd(REPO_ROOT).nothrow()
  for (const path of DISPOSABLE_PATHS) {
    if (!path.startsWith('/tmp/openspecui-owner-')) {
      throw new Error(`Refusing cleanup outside the visual-review namespace: ${path}`)
    }
    await rm(path, { recursive: true, force: true })
  }
  console.log('Removed the fixed /tmp/openspecui-owner-* visual-review fixtures.')
}

const argv = await yargs(hideBin(process.argv))
  .command('$0 <action>', 'Prepare or run one visual-review boundary', (command) =>
    command.positional('action', {
      choices: [
        'doctor',
        'setup',
        'setup-stores',
        'build',
        'start-app',
        'serve-manual',
        'serve-env-a',
        'serve-env-b',
        'cleanup',
      ] as const,
      demandOption: true,
    })
  )
  .strict()
  .help()
  .parse()

switch (argv.action) {
  case 'doctor':
    console.log(`Repository: ${REPO_ROOT}`)
    await $`git status --short --branch`.cwd(REPO_ROOT)
    await $`bun --version`
    await $`pnpm --version`
    break
  case 'setup':
    await setup()
    break
  case 'setup-stores':
    await setupStores()
    break
  case 'build':
    await $`pnpm --filter @openspecui/app build`.cwd(REPO_ROOT)
    break
  case 'start-app':
    await $`env OPENSPECUI_HOME=${OWNER_HOME} pnpm openspecui start --web`.cwd(REPO_ROOT)
    break
  case 'serve-manual':
    await $`env OPENSPECUI_HOME=${MANUAL_HOME} pnpm openspecui serve ${REPO_ROOT}/example --no-open --port 33101`.cwd(
      REPO_ROOT
    )
    break
  case 'serve-env-a':
    await $`env XDG_DATA_HOME=${ENV_A} OPENSPECUI_HOME=${OWNER_HOME} pnpm openspecui serve ${REPO_ROOT} --app --no-open --port 33111`.cwd(
      REPO_ROOT
    )
    break
  case 'serve-env-b':
    await $`env XDG_DATA_HOME=${ENV_B} OPENSPECUI_HOME=${OWNER_HOME} pnpm openspecui serve ${REPO_ROOT}/references/openspec --app --no-open --port 33112`.cwd(
      REPO_ROOT
    )
    break
  case 'cleanup':
    await cleanup()
    break
}
