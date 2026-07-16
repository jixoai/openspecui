/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Prove three configuration owners retain distinct roots and evidence.
 * 2. Prove binding and active-root writes never cross ownership boundaries.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 */
import { CliExecutor, ConfigManager, type RootContext } from '@openspecui/core'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readActiveRootConfig,
  readEnvironmentGlobalConfig,
  readProjectBindingConfig,
  writeActiveRootConfig,
  writeProjectBindingConfig,
} from './planning-config-service.js'

const tempDirs: string[] = []

function rootContext(launchProject: string, planningRoot: string): RootContext {
  return {
    launchProject: { path: launchProject },
    planningRoot: {
      path: planningRoot,
      source: 'declared',
      store_id: 'shared',
      healthy: true,
      status: [],
    },
    storeId: 'shared',
    cli: { available: true, version: '1.6.0' },
    references: [],
    contextMembers: [],
    dataScope: {
      path: '/runtime/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(tempDirs.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('planning config ownership', () => {
  it('reads Project Binding from launch project and Active Root Config from the selected Store', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-config-'))
    tempDirs.push(tempDir)
    const launchProject = join(tempDir, 'launch')
    const planningRoot = join(tempDir, 'planning')
    await Promise.all([
      mkdir(join(launchProject, 'openspec'), { recursive: true }),
      mkdir(join(planningRoot, 'openspec'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(
        join(launchProject, 'openspec', 'config.yaml'),
        'store: shared\nreferences: [platform]\n',
        'utf8'
      ),
      writeFile(
        join(planningRoot, 'openspec', 'config.yaml'),
        'schema: custom\ncontext: active root\n',
        'utf8'
      ),
    ])
    const context = rootContext(launchProject, planningRoot)
    const preview = {
      state: 'ready' as const,
      data: context,
      attempt: null,
      error: null,
      observedAt: 1,
    }

    const [binding, active] = await Promise.all([
      readProjectBindingConfig({ launchProjectDir: launchProject, rootPreview: preview }),
      readActiveRootConfig({ launchProjectDir: launchProject, rootContext: context }),
    ])

    expect(binding.owner.path).toBe(launchProject)
    expect(binding.binding).toMatchObject({
      store: { state: 'declared', id: 'shared' },
      references: { state: 'declared', entries: [{ id: 'platform' }] },
    })
    expect(active.owner).toMatchObject({
      path: planningRoot,
      source: 'declared',
      storeId: 'shared',
      externalToLaunchProject: true,
    })
    expect(active.file.content).toContain('context: active root')
  })

  it('writes Project Binding and Active Root Config only to their selected owners', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-planning-config-write-'))
    tempDirs.push(tempDir)
    const launchProject = join(tempDir, 'launch')
    const planningRoot = join(tempDir, 'planning')
    await Promise.all([
      mkdir(join(launchProject, 'openspec'), { recursive: true }),
      mkdir(join(planningRoot, 'openspec'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(launchProject, 'openspec', 'config.yaml'), 'schema: launch\n', 'utf8'),
      writeFile(join(planningRoot, 'openspec', 'config.yaml'), 'schema: old\n', 'utf8'),
    ])
    const context = rootContext(launchProject, planningRoot)

    await writeProjectBindingConfig({
      launchProjectDir: launchProject,
      update: { store: 'shared', references: [{ id: 'platform' }] },
    })
    await writeActiveRootConfig({
      launchProjectDir: launchProject,
      rootContext: context,
      content: 'schema: active\n',
    })

    await expect(readFile(join(launchProject, 'openspec', 'config.yaml'), 'utf8')).resolves.toMatch(
      /schema: launch[\s\S]*store: shared/
    )
    await expect(readFile(join(planningRoot, 'openspec', 'config.yaml'), 'utf8')).resolves.toBe(
      'schema: active\n'
    )
  })

  it('preserves CLI path/list evidence for Environment Global Config', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'openspecui-environment-config-'))
    tempDirs.push(tempDir)
    const configPath = join(tempDir, 'config.json')
    await writeFile(configPath, '{"profile":"core"}\n', 'utf8')
    const cliExecutor = new CliExecutor(new ConfigManager(tempDir), tempDir)
    vi.spyOn(cliExecutor, 'execute')
      .mockResolvedValueOnce({
        success: true,
        stdout: `${configPath}\n`,
        stderr: '',
        exitCode: 0,
      })
      .mockResolvedValueOnce({
        success: true,
        stdout: '{"profile":"core","workflows":["apply"]}',
        stderr: '',
        exitCode: 0,
      })

    const result = await readEnvironmentGlobalConfig({
      dataScope: {
        path: '/runtime/openspec',
        source: 'xdg-data-home',
        environmentVariable: 'XDG_DATA_HOME',
      },
      cliExecutor,
    })

    expect(result.owner.kind).toBe('runtime-environment')
    expect(result.file).toMatchObject({ path: configPath, exists: true, format: 'json' })
    expect(result.config).toEqual({ profile: 'core', workflows: ['apply'] })
    expect(result.evidence.path.exitCode).toBe(0)
    expect(result.evidence.config.stdout).toContain('"profile":"core"')
  })
})
