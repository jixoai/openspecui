/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Resolve one disposable two-project loading walkthrough topology.
 * 2. Run pinned OpenSpec and workspace commands under one isolated XDG data home.
 * 3. Guard every destructive lab operation with an owned marker.
 * 4. Provide deterministic Project and Store fixtures for invalidation exercises.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 */
import { spawn } from 'node:child_process'
import { access, mkdir, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Argv } from '../../../../packages/cli/node_modules/@types/yargs'

const walkthroughDirectory = dirname(fileURLToPath(import.meta.url))

export const repositoryRoot = resolve(walkthroughDirectory, '../../../../')
export const defaultLabDirectory = '/tmp/openspecui-live-projection-walkthrough'
export const labMarkerName = '.openspecui-live-projection-walkthrough.json'
export const labMarkerKind = 'openspecui-live-projection-walkthrough'
export const referenceStoreId = 'shared-reference'
export const openSpecCliBin = join(
  repositoryRoot,
  'packages/core/node_modules/openspec-cli-16/bin/openspec.js'
)

const requireFromCli = createRequire(join(repositoryRoot, 'packages/cli/package.json'))
const yargsHelpers = requireFromCli('yargs/helpers') as {
  hideBin(argv: string[]): string[]
}

/** Typed yargs runtime sourced from the workspace CLI package that already owns the dependency. */
export const walkthroughYargs = requireFromCli('yargs') as Argv
export const hideWalkthroughBin = yargsHelpers.hideBin

export type BackendId = 'a' | 'b'

export interface WalkthroughTarget {
  id: BackendId
  port: number
  benchmarkPort: number
  projectDir: string
  dataHome: string
}

export interface WalkthroughLab {
  root: string
  appPort: number
  appUrl: string
  dataHome: string
  referenceStoreDir: string
  targets: Record<BackendId, WalkthroughTarget>
}

/** Resolve all lab paths and ports from the operator-selected disposable root. */
export function resolveLab(root: string): WalkthroughLab {
  const labRoot = resolve(root)
  const dataHome = join(labRoot, 'data-home')
  return {
    root: labRoot,
    appPort: 13_105,
    appUrl: 'http://127.0.0.1:13105',
    dataHome,
    referenceStoreDir: join(labRoot, 'stores', referenceStoreId),
    targets: {
      a: {
        id: 'a',
        port: 3_211,
        benchmarkPort: 34_911,
        projectDir: join(labRoot, 'project-a'),
        dataHome,
      },
      b: {
        id: 'b',
        port: 3_212,
        benchmarkPort: 34_912,
        projectDir: join(labRoot, 'project-b'),
        dataHome,
      },
    },
  }
}

/** Select one known backend without accepting arbitrary paths or ports. */
export function targetFor(lab: WalkthroughLab, rawId: string): WalkthroughTarget {
  if (rawId === 'a' || rawId === 'b') return lab.targets[rawId]
  throw new Error(`Unknown backend ${JSON.stringify(rawId)}. Expected a or b.`)
}

export function markerPath(lab: WalkthroughLab): string {
  return join(lab.root, labMarkerName)
}

/** Refuse to operate on a lab that was not created by this walkthrough. */
export async function requirePreparedLab(lab: WalkthroughLab): Promise<void> {
  if (!(await pathExists(markerPath(lab)))) {
    throw new Error(
      `Walkthrough lab ${lab.root} is not prepared. Run bun lab.sh.ts prepare --lab ${lab.root}.`
    )
  }
  const value: unknown = JSON.parse(await readFile(markerPath(lab), 'utf8'))
  if (!value || typeof value !== 'object' || !('kind' in value) || value.kind !== labMarkerKind) {
    throw new Error(`Refusing to use ${lab.root}: its walkthrough marker is invalid.`)
  }
}

/** Keep every OpenSpec surface on the same isolated registry/config-independent data scope. */
export function openSpecEnvironment(dataHome: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    XDG_DATA_HOME: dataHome,
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
  }
}

/** Run a foreground command and preserve its terminal output for owner inspection. */
export async function runCommand(input: {
  command: string
  args: readonly string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}): Promise<void> {
  const child = spawn(input.command, input.args, {
    cwd: input.cwd ?? repositoryRoot,
    env: input.env ?? process.env,
    stdio: 'inherit',
  })
  const exitCode = await new Promise<number>((resolveExit, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code !== null) {
        resolveExit(code)
        return
      }
      reject(new Error(`${input.command} terminated by signal ${signal ?? 'unknown'}.`))
    })
  })
  if (exitCode !== 0) {
    throw new Error(
      `${input.command} ${input.args.join(' ')} exited with status ${String(exitCode)}.`
    )
  }
}

/** Execute the repository-pinned OpenSpec 1.6 binary, never a PATH-global CLI. */
export async function runOpenSpec(
  args: readonly string[],
  input: { cwd: string; dataHome: string }
): Promise<void> {
  await runCommand({
    command: 'node',
    args: [openSpecCliBin, ...args],
    cwd: input.cwd,
    env: openSpecEnvironment(input.dataHome),
  })
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export function projectConfig(): string {
  return ['schema: spec-driven', 'references:', `  - ${referenceStoreId}`, ''].join('\n')
}

export function sampleSpec(title: string, version = 'baseline'): string {
  return [
    `# ${title} Specification`,
    '',
    '## Purpose',
    '',
    `Disposable live-projection walkthrough fixture for ${title}.`,
    '',
    '## Requirements',
    '',
    `### Requirement: ${title} remains observable`,
    '',
    `The system SHALL expose the ${title} fixture at version ${version}.`,
    '',
    '#### Scenario: Projection settles',
    '',
    '- **WHEN** the fixture is projected',
    `- **THEN** the ${title} evidence is visible`,
    '',
  ].join('\n')
}

export function projectSpecPath(target: WalkthroughTarget): string {
  return join(target.projectDir, 'openspec', 'specs', `project-${target.id}`, 'spec.md')
}

export function projectConfigPath(target: WalkthroughTarget): string {
  return join(target.projectDir, 'openspec', 'config.yaml')
}

export function referenceSpecPath(lab: WalkthroughLab): string {
  return join(lab.referenceStoreDir, 'openspec', 'specs', 'shared-contract', 'spec.md')
}
