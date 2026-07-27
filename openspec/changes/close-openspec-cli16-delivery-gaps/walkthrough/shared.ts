/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Resolve the disposable OpenSpec 1.6 walkthrough topology from one lab directory.
 * 2. Run pinned OpenSpec and workspace commands without serializing Access Gate secrets.
 * 3. Provide marker-guarded lab ownership checks shared by the walkthrough command tools.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 */
import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export const repositoryRoot = resolve(import.meta.dir, '../../../../')
export const defaultLabDirectory = '/tmp/openspecui-cli16-walkthrough'
export const labMarkerName = '.openspecui-cli16-walkthrough.json'
export const openSpecCliBin = join(
  repositoryRoot,
  'packages/core/node_modules/openspec-cli-16/bin/openspec.js'
)

export type BackendId = 'a' | 'b' | 'c'

export interface WalkthroughTarget {
  id: BackendId
  port: number
  projectDir: string
  dataHome: string
}

export interface WalkthroughLab {
  root: string
  appUrl: string
  appPort: number
  targets: Record<BackendId, WalkthroughTarget>
}

export function resolveLab(root: string): WalkthroughLab {
  const labRoot = resolve(root)
  const sharedDataHome = join(labRoot, 'data-shared')
  const distinctDataHome = join(labRoot, 'data-distinct')
  return {
    root: labRoot,
    appPort: 13005,
    appUrl: 'http://127.0.0.1:13005',
    targets: {
      a: {
        id: 'a',
        port: 3111,
        projectDir: join(labRoot, 'project-a'),
        dataHome: sharedDataHome,
      },
      b: {
        id: 'b',
        port: 3112,
        projectDir: join(labRoot, 'project-b'),
        dataHome: sharedDataHome,
      },
      c: {
        id: 'c',
        port: 3113,
        projectDir: join(labRoot, 'project-c'),
        dataHome: distinctDataHome,
      },
    },
  }
}

export function targetFor(lab: WalkthroughLab, rawId: string): WalkthroughTarget {
  if (rawId === 'a' || rawId === 'b' || rawId === 'c') return lab.targets[rawId]
  throw new Error(`Unknown backend ${JSON.stringify(rawId)}. Expected a, b, or c.`)
}

export function markerPath(lab: WalkthroughLab): string {
  return join(lab.root, labMarkerName)
}

export async function requirePreparedLab(lab: WalkthroughLab): Promise<void> {
  const marker = Bun.file(markerPath(lab))
  if (!(await marker.exists())) {
    throw new Error(
      `Walkthrough lab ${lab.root} is not prepared. Run bun lab.sh.ts prepare --lab ${lab.root}.`
    )
  }
  const value: unknown = await marker.json()
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    value.kind !== 'openspecui-cli16-walkthrough'
  ) {
    throw new Error(`Refusing to use ${lab.root}: its walkthrough marker is invalid.`)
  }
}

export function openSpecEnvironment(dataHome: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    XDG_DATA_HOME: dataHome,
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
  }
}

export async function runCommand(input: {
  command: string
  args: readonly string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
}): Promise<void> {
  const child = Bun.spawn([input.command, ...input.args], {
    cwd: input.cwd ?? repositoryRoot,
    env: input.env ?? process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await child.exited
  if (exitCode !== 0) {
    throw new Error(
      `${input.command} ${input.args.join(' ')} exited with status ${String(exitCode)}.`
    )
  }
}

export async function runOpenSpec(
  args: readonly string[],
  input: { cwd: string; dataHome: string }
): Promise<void> {
  await runCommand({
    command: process.execPath,
    args: [openSpecCliBin, ...args],
    cwd: input.cwd,
    env: openSpecEnvironment(input.dataHome),
  })
}

export async function writeText(path: string, content: string): Promise<void> {
  await Bun.write(path, content)
}

export async function ensureDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
}

export async function pathExists(path: string): Promise<boolean> {
  return Bun.file(path).exists()
}

export function parentDirectory(path: string): string {
  return dirname(path)
}
