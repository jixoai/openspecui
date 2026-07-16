/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Read launch-project binding and active-root config from physically distinct roots.
 * 2. Project environment-global config through CLI-owned path/list evidence.
 * 3. Mutate only the explicitly selected ownership facet and refresh reactive caches.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 */
import {
  EnvironmentGlobalConfigValueSchema,
  inspectProjectBinding,
  parseCliCommandResult,
  reactiveReadFile,
  updateProjectBindingContent,
  updateReactiveFileCache,
  type ActiveRootConfig,
  type CliExecutor,
  type CliJsonValue,
  type EnvironmentGlobalConfig,
  type OpenSpecDataScope,
  type ProjectBindingConfig,
  type ProjectBindingUpdate,
  type RootContext,
  type RootContextResolvedState,
} from '@openspecui/core'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

interface ReadProjectConfigFileOptions {
  rootPath: string
}

async function readProjectConfigFile(
  options: ReadProjectConfigFileOptions
): Promise<ActiveRootConfig['file']> {
  const yamlPath = join(options.rootPath, 'openspec', 'config.yaml')
  const yaml = await reactiveReadFile(yamlPath)
  if (yaml !== null) {
    return { path: yamlPath, format: 'yaml', exists: true, content: yaml }
  }

  const ymlPath = join(options.rootPath, 'openspec', 'config.yml')
  const yml = await reactiveReadFile(ymlPath)
  if (yml !== null) {
    return { path: ymlPath, format: 'yml', exists: true, content: yml }
  }

  return { path: yamlPath, format: 'yaml', exists: false, content: null }
}

function currentRootContext(state: RootContextResolvedState): RootContext {
  return state.state === 'ready' ? state.data : state.attempt
}

export async function readProjectBindingConfig(input: {
  launchProjectDir: string
  rootPreview: RootContextResolvedState
}): Promise<ProjectBindingConfig> {
  const file = await readProjectConfigFile({ rootPath: input.launchProjectDir })
  return {
    kind: 'project-binding',
    owner: { kind: 'launch-project', path: input.launchProjectDir },
    file,
    binding: inspectProjectBinding(file.content),
    rootPreview: input.rootPreview,
  }
}

export async function readActiveRootConfig(input: {
  launchProjectDir: string
  rootContext: RootContext
}): Promise<ActiveRootConfig> {
  const planningRoot = input.rootContext.planningRoot
  if (!planningRoot) throw new Error('Planning root is unavailable.')
  return {
    kind: 'active-root',
    owner: {
      kind: 'planning-root',
      path: planningRoot.path,
      source: planningRoot.source,
      storeId: input.rootContext.storeId,
      externalToLaunchProject: planningRoot.path !== input.launchProjectDir,
    },
    file: await readProjectConfigFile({ rootPath: planningRoot.path }),
  }
}

export async function readEnvironmentGlobalConfig(input: {
  dataScope: OpenSpecDataScope
  cliExecutor: CliExecutor
}): Promise<EnvironmentGlobalConfig> {
  const [pathEvidence, configResult] = await Promise.all([
    input.cliExecutor.execute(['config', 'path']),
    input.cliExecutor.execute(['config', 'list', '--json']),
  ])
  const configEvidence = parseCliCommandResult(configResult, EnvironmentGlobalConfigValueSchema)
  const configPath = pathEvidence.success ? pathEvidence.stdout.trim() || null : null
  const content = configPath ? await reactiveReadFile(configPath) : null

  return {
    kind: 'environment-global',
    owner: { kind: 'runtime-environment', dataScope: input.dataScope },
    file: {
      path: configPath,
      format: 'json',
      exists: content !== null,
      content,
    },
    config: configEvidence.data,
    evidence: { path: pathEvidence, config: configEvidence },
  }
}

async function writeConfigFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
  updateReactiveFileCache(path, content)
}

export async function writeProjectBindingConfig(input: {
  launchProjectDir: string
  update: ProjectBindingUpdate
}): Promise<void> {
  const file = await readProjectConfigFile({ rootPath: input.launchProjectDir })
  if (!file.path) throw new Error('Launch-project config path is unavailable.')
  await writeConfigFile(file.path, updateProjectBindingContent(file.content, input.update))
}

export async function writeActiveRootConfig(input: {
  launchProjectDir: string
  rootContext: RootContext
  content: string
}): Promise<void> {
  const active = await readActiveRootConfig(input)
  if (!active.file.path) throw new Error('Active-root config path is unavailable.')
  await writeConfigFile(active.file.path, input.content)
}

export async function writeEnvironmentGlobalConfig(input: {
  cliExecutor: CliExecutor
  config: Record<string, CliJsonValue>
}): Promise<void> {
  const pathEvidence = await input.cliExecutor.execute(['config', 'path'])
  if (!pathEvidence.success) {
    throw new Error(pathEvidence.stderr || 'Failed to resolve OpenSpec global config path.')
  }
  const configPath = pathEvidence.stdout.trim()
  if (!configPath) throw new Error('OpenSpec global config path is empty.')
  await writeConfigFile(configPath, `${JSON.stringify(input.config, null, 2)}\n`)
}

export function dataScopeFromRootPreview(state: RootContextResolvedState): OpenSpecDataScope {
  return currentRootContext(state).dataScope
}
