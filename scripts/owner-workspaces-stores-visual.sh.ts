/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Prepare and remove fixed disposable Workspaces/Stores visual-review fixtures under the system temp root.
 * 2. Expose exact build, App start, and foreground backend commands without hiding process ownership.
 * 3. Keep environment injection and Windows directory linking shell-independent.
 * 4. Refuse destructive cleanup outside the script-owned fixture root.
 *
 * Original request (2026-07-31): "顺便准备一些必要的脚本方便我完成走查工作"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { $ } from 'bun'
import { lstat, mkdir, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const REPO_ROOT = resolve(import.meta.dir, '..')
const FIXTURE_ROOT = join(tmpdir(), 'openspecui-owner-fixtures')
const OWNER_HOME = join(FIXTURE_ROOT, 'home')
const ALIAS_ROOT = join(FIXTURE_ROOT, 'alias')
const ALIAS_PROJECT = join(ALIAS_ROOT, 'openspecui')
const MANUAL_HOME = join(FIXTURE_ROOT, 'manual-home')
const ENV_A = join(FIXTURE_ROOT, 'env-a')
const ENV_B = join(FIXTURE_ROOT, 'env-b')
const STORE_A = join(FIXTURE_ROOT, 'store-a')
const STORE_B = join(FIXTURE_ROOT, 'store-b')

const DISPOSABLE_PATHS = [OWNER_HOME, ALIAS_ROOT, MANUAL_HOME, ENV_A, ENV_B, STORE_A, STORE_B]

function configureShellEnvironment(overrides: Readonly<Record<string, string>>): void {
  const environment: Record<string, string> = { ...overrides }
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && environment[key] === undefined) environment[key] = value
  }
  $.env(environment)
}

function isOwnedFixturePath(path: string): boolean {
  const relativePath = relative(FIXTURE_ROOT, resolve(path))
  return (
    relativePath === '' ||
    (relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
  )
}

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
  await symlink(REPO_ROOT, ALIAS_PROJECT, process.platform === 'win32' ? 'junction' : 'dir')
  console.log(`Prepared:\n- ${OWNER_HOME}\n- ${ALIAS_PROJECT} -> ${REPO_ROOT}`)
}

async function setupStores(): Promise<void> {
  for (const path of [ENV_A, ENV_B, STORE_A, STORE_B]) {
    if (await pathExists(path))
      throw new Error(`Refusing to replace existing fixture path: ${path}`)
  }
  configureShellEnvironment({ XDG_DATA_HOME: ENV_A })
  await $`node ${REPO_ROOT}/references/openspec/bin/openspec.js store setup shared --path ${STORE_A} --no-init-git --json`.cwd(
    REPO_ROOT
  )
  configureShellEnvironment({ XDG_DATA_HOME: ENV_B })
  await $`node ${REPO_ROOT}/references/openspec/bin/openspec.js store setup shared --path ${STORE_B} --no-init-git --json`.cwd(
    REPO_ROOT
  )
}

async function cleanup(): Promise<void> {
  configureShellEnvironment({ OPENSPECUI_HOME: OWNER_HOME })
  await $`pnpm openspecui stop`.cwd(REPO_ROOT).nothrow()
  for (const path of DISPOSABLE_PATHS) {
    if (!isOwnedFixturePath(path)) {
      throw new Error(`Refusing cleanup outside the visual-review namespace: ${path}`)
    }
    await rm(path, {
      recursive: true,
      force: true,
      maxRetries: process.platform === 'win32' ? 20 : 0,
      retryDelay: 50,
    })
  }
  await rm(FIXTURE_ROOT, { recursive: true, force: true })
  console.log(`Removed visual-review fixtures under ${FIXTURE_ROOT}.`)
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
    configureShellEnvironment({ OPENSPECUI_HOME: OWNER_HOME })
    await $`pnpm openspecui start --web`.cwd(REPO_ROOT)
    break
  case 'serve-manual':
    configureShellEnvironment({ OPENSPECUI_HOME: MANUAL_HOME })
    await $`pnpm openspecui serve ${join(REPO_ROOT, 'example')} --no-open --port 33101`.cwd(
      REPO_ROOT
    )
    break
  case 'serve-env-a':
    configureShellEnvironment({ XDG_DATA_HOME: ENV_A, OPENSPECUI_HOME: OWNER_HOME })
    await $`pnpm openspecui serve ${REPO_ROOT} --app --no-open --port 33111`.cwd(REPO_ROOT)
    break
  case 'serve-env-b':
    configureShellEnvironment({ XDG_DATA_HOME: ENV_B, OPENSPECUI_HOME: OWNER_HOME })
    await $`pnpm openspecui serve ${join(REPO_ROOT, 'references', 'openspec')} --app --no-open --port 33112`.cwd(
      REPO_ROOT
    )
    break
  case 'cleanup':
    await cleanup()
    break
}
