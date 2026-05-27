import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildRuntimePackageInstallCommand,
  detectRuntimePackageManager,
  resolveRuntimePackageInstallStrategy,
} from './runtime-package-manager.js'

const createdDirs: string[] = []

async function createTempTree(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'openspecui-runtime-pm-'))
  createdDirs.push(dir)
  return dir
}

describe('detectRuntimePackageManager', () => {
  afterEach(async () => {
    await Promise.all(createdDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })

  it('prefers npm-compatible user agent when present', async () => {
    const dir = await createTempTree()
    expect(
      detectRuntimePackageManager({
        startDir: dir,
        env: { npm_config_user_agent: 'pnpm/10.22.0 node/v22.0.0 darwin arm64' },
      })
    ).toEqual({
      id: 'pnpm',
      source: 'user-agent',
    })
  })

  it('falls back to npm_execpath when user agent is missing', async () => {
    const dir = await createTempTree()
    expect(
      detectRuntimePackageManager({
        startDir: dir,
        env: { npm_execpath: '/Users/test/.volta/tools/image/packages/pnpm/lib/pnpm.cjs' },
      })
    ).toEqual({
      id: 'pnpm',
      source: 'exec-path',
    })
  })

  it('detects vp from npm_execpath when vite-plus is the launcher', async () => {
    const dir = await createTempTree()
    expect(
      detectRuntimePackageManager({
        startDir: dir,
        env: { npm_execpath: '/Users/test/.vite-plus/bin/vite-plus.mjs' },
      })
    ).toEqual({
      id: 'vp',
      source: 'exec-path',
    })
  })

  it('detects deno from the dedicated runtime environment flag', async () => {
    const dir = await createTempTree()
    expect(
      detectRuntimePackageManager({
        startDir: dir,
        env: { DENO_VERSION: '2.2.0' },
      })
    ).toEqual({
      id: 'deno',
      source: 'deno-env',
    })
  })

  it('reads packageManager from the nearest ancestor package.json', async () => {
    const dir = await createTempTree()
    const workspaceDir = join(dir, 'workspace')
    const nestedDir = join(workspaceDir, 'node_modules', 'openspecui')
    await mkdir(nestedDir, { recursive: true })
    await writeFile(
      join(workspaceDir, 'package.json'),
      JSON.stringify({ packageManager: 'bun@1.2.15' }, null, 2)
    )

    expect(
      detectRuntimePackageManager({
        startDir: nestedDir,
        env: {},
      })
    ).toEqual({
      id: 'bun',
      source: 'package-manager-field',
    })
  })

  it('preserves unknown package manager ids from packageManager fields', async () => {
    const dir = await createTempTree()
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ packageManager: 'vp@0.7.0' }, null, 2)
    )

    expect(
      detectRuntimePackageManager({
        startDir: dir,
        env: {},
      })
    ).toEqual({
      id: 'vp',
      source: 'package-manager-field',
    })
  })

  it('falls back to ancestor lockfiles when no environment hint exists', async () => {
    const dir = await createTempTree()
    const workspaceDir = join(dir, 'workspace')
    const nestedDir = join(
      workspaceDir,
      'node_modules',
      '.pnpm',
      'openspecui@3.11.1',
      'node_modules',
      'openspecui'
    )
    await mkdir(nestedDir, { recursive: true })
    await writeFile(join(workspaceDir, 'pnpm-lock.yaml'), 'lockfileVersion: "9.0"\n')

    expect(
      detectRuntimePackageManager({
        startDir: nestedDir,
        env: {},
      })
    ).toEqual({
      id: 'pnpm',
      source: 'lockfile',
    })
  })

  it('falls back to npm when no runtime hint can be found', async () => {
    const dir = await createTempTree()
    expect(
      detectRuntimePackageManager({
        startDir: dir,
        env: {},
      })
    ).toEqual({
      id: 'npm',
      source: 'fallback',
    })
  })
})

describe('buildRuntimePackageInstallCommand', () => {
  it('builds an npm install command with the workspace escape hatch', () => {
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'npm',
        packages: ['@huggingface/transformers@~4.2.0'],
        dependencyField: 'optionalDependencies',
        ignoreWorkspace: true,
      })
    ).toEqual({
      cmd: 'npm',
      args: [
        'install',
        '--ignore-workspace',
        '--save-optional',
        '@huggingface/transformers@~4.2.0',
      ],
      displayCommand:
        'npm install --ignore-workspace --save-optional @huggingface/transformers@~4.2.0',
    })
  })

  it('builds add commands for npm-compatible package managers', () => {
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'pnpm',
        packages: ['@huggingface/transformers@~4.2.0'],
        dependencyField: 'optionalDependencies',
        allowBuildPackages: ['onnxruntime-node'],
      })
    ).toEqual({
      cmd: 'pnpm',
      args: [
        'add',
        '--save-optional',
        '--allow-build',
        'onnxruntime-node',
        '@huggingface/transformers@~4.2.0',
      ],
      displayCommand:
        'pnpm add --save-optional --allow-build onnxruntime-node @huggingface/transformers@~4.2.0',
    })
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'yarn',
        packages: ['@huggingface/transformers@~4.2.0'],
        dependencyField: 'optionalDependencies',
      })
    ).toEqual({
      cmd: 'yarn',
      args: ['add', '--optional', '@huggingface/transformers@~4.2.0'],
      displayCommand: 'yarn add --optional @huggingface/transformers@~4.2.0',
    })
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'bun',
        packages: ['@huggingface/transformers@~4.2.0'],
        dependencyField: 'optionalDependencies',
      })
    ).toEqual({
      cmd: 'bun',
      args: ['add', '--optional', '@huggingface/transformers@~4.2.0'],
      displayCommand: 'bun add --optional @huggingface/transformers@~4.2.0',
    })
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'vp',
        packages: ['@huggingface/transformers@~4.2.0'],
        dependencyField: 'optionalDependencies',
        allowBuildPackages: ['onnxruntime-node'],
      })
    ).toEqual({
      cmd: 'vp',
      args: [
        'add',
        '--save-optional',
        '--allow-build',
        'onnxruntime-node',
        '@huggingface/transformers@~4.2.0',
      ],
      displayCommand:
        'vp add --save-optional --allow-build onnxruntime-node @huggingface/transformers@~4.2.0',
    })
  })

  it('builds a deno add command and marks it for manifest reconciliation', () => {
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'deno',
        packages: ['@huggingface/transformers@~4.2.0'],
        dependencyField: 'optionalDependencies',
        allowBuildPackages: ['onnxruntime-node'],
      })
    ).toEqual({
      cmd: 'deno',
      args: [
        'add',
        '--npm',
        '--node-modules-dir=auto',
        '--allow-scripts=onnxruntime-node',
        'npm:@huggingface/transformers@~4.2.0',
      ],
      displayCommand:
        'deno add --npm --node-modules-dir=auto --allow-scripts=onnxruntime-node npm:@huggingface/transformers@~4.2.0',
    })
    expect(resolveRuntimePackageInstallStrategy('deno')?.preservesDependencyField).toBe(false)
  })

  it('rejects unknown runtime hosts', () => {
    expect(
      buildRuntimePackageInstallCommand({
        packageManager: 'custom-pm',
        packages: ['@huggingface/transformers@~4.2.0'],
      })
    ).toBeNull()
  })
})
