/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Read launch-project binding and reusable YAML source from its physical owner.
 * 2. Project environment-global config, profile, and drift through one CLI-owned reactive read.
 * 3. Mutate Project Binding or Environment Global only and refresh reactive caches.
 * 4. Return launch-file write evidence without waiting for Planning-root service convergence.
 * 5. Keep configured Environment defaults separate from effective Root Context and file bytes.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Profile/Drift must refresh with external environment config changes."
 * Derived requirement (2026-07-19): "Project Binding mutation uses write-then-converge settlement."
 * Derived requirement (2026-08-02): "Active Root revision-aware mutation moves to its own physical service."
 */
import {
  EnvironmentGlobalConfigValueSchema,
  inspectEnvironmentDefaultStore,
  inspectProjectBinding,
  parseCliCommandResult,
  reactiveReadFile,
  updateProjectBindingContent,
  updateReactiveFileCache,
  writePhysicalReactiveFile,
  type ActiveRootConfigFile,
  type CliExecutor,
  type CliJsonValue,
  type EnvironmentDefaultStoreUpdate,
  type EnvironmentGlobalCliProjection,
  type EnvironmentGlobalFileProjection,
  type EnvironmentGlobalProfileState,
  type OpenSpecDataScope,
  type ProjectBindingConfig,
  type ProjectBindingLaunchWrite,
  type ProjectBindingUpdate,
  type RootContext,
  type RootContextResolvedState,
} from '@openspecui/core'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { effectiveOpsxWorkflowList, parseOpsxConfigDrift } from './opsx-profile-state.js'

interface ReadProjectConfigFileOptions {
  rootPath: string
}

function projectEnvironmentProfileState(
  config: Record<string, CliJsonValue> | null,
  configError: string | undefined,
  driftEvidence: Awaited<ReturnType<CliExecutor['execute']>>
): EnvironmentGlobalProfileState {
  if (!config) {
    return {
      available: false,
      profile: null,
      delivery: null,
      workflows: [],
      driftStatus: 'unknown',
      warningText: null,
      ...(configError ? { error: configError } : {}),
    }
  }
  const profile = config.profile === 'core' || config.profile === 'custom' ? config.profile : null
  const delivery =
    config.delivery === 'both' || config.delivery === 'skills' || config.delivery === 'commands'
      ? config.delivery
      : null
  if (!driftEvidence.success) {
    return {
      available: true,
      profile,
      delivery,
      workflows: effectiveOpsxWorkflowList(config),
      driftStatus: 'unknown',
      warningText: null,
    }
  }
  const drift = parseOpsxConfigDrift(`${driftEvidence.stdout}\n${driftEvidence.stderr}`)
  return {
    available: true,
    profile,
    delivery,
    workflows: effectiveOpsxWorkflowList(config),
    driftStatus: drift.drift ? 'drift' : 'in-sync',
    warningText: drift.warningText,
  }
}

/** Read the preferred config.yaml/config.yml source under one physical project or Store root. */
export async function readPlanningYamlConfigFile(
  options: ReadProjectConfigFileOptions
): Promise<ActiveRootConfigFile> {
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

/** Read project-owned Store and Reference declarations from the launch project. */
export async function readProjectBindingConfig(input: {
  launchProjectDir: string
  rootPreview: RootContextResolvedState
}): Promise<ProjectBindingConfig> {
  const file = await readPlanningYamlConfigFile({ rootPath: input.launchProjectDir })
  return {
    kind: 'project-binding',
    owner: { kind: 'launch-project', path: input.launchProjectDir },
    file,
    binding: inspectProjectBinding(file.content),
    rootPreview: input.rootPreview,
  }
}

/** Resolve and read the CLI-selected environment-global configuration file. */
export async function readEnvironmentGlobalConfig(input: {
  dataScope: OpenSpecDataScope
  cliExecutor: CliExecutor
  /** Acquire the CLI-resolved physical config path before its reactive content read. */
  observeConfigPath?(path: string | null): Promise<void>
}): Promise<EnvironmentGlobalCliProjection> {
  const [pathEvidence, configResult, driftEvidence] = await Promise.all([
    input.cliExecutor.execute(['config', 'path']),
    input.cliExecutor.execute(['config', 'list', '--json']),
    input.cliExecutor.execute(['config', 'list']),
  ])
  const configEvidence = parseCliCommandResult(configResult, EnvironmentGlobalConfigValueSchema)
  const configPath = pathEvidence.success ? pathEvidence.stdout.trim() || null : null
  await input.observeConfigPath?.(configPath)
  return {
    kind: 'environment-global',
    owner: { kind: 'runtime-environment', dataScope: input.dataScope },
    configPath,
    config: configEvidence.data,
    defaultStore: inspectEnvironmentDefaultStore(configEvidence.data),
    profileState: projectEnvironmentProfileState(
      configEvidence.data,
      configEvidence.contractError ??
        (configEvidence.success
          ? undefined
          : configEvidence.stderr || 'Failed to load profile config.'),
      driftEvidence
    ),
    evidence: { path: pathEvidence, config: configEvidence, drift: driftEvidence },
  }
}

/** Read the file-native Environment Global document selected by the CLI path. */
export async function readEnvironmentGlobalFileConfig(input: {
  dataScope: OpenSpecDataScope
  configPath: string | null
}): Promise<EnvironmentGlobalFileProjection> {
  const content = input.configPath ? await reactiveReadFile(input.configPath) : null
  return {
    kind: 'environment-global-file',
    owner: { kind: 'runtime-environment', dataScope: input.dataScope },
    file: {
      path: input.configPath,
      format: 'json',
      exists: content !== null,
      content,
    },
  }
}

async function writeConfigFile(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
  updateReactiveFileCache(path, content)
}

/** Update only project binding fields in the launch-project configuration. */
export async function writeProjectBindingConfig(input: {
  launchProjectDir: string
  update: ProjectBindingUpdate
}): Promise<ProjectBindingLaunchWrite> {
  const file = await readPlanningYamlConfigFile({ rootPath: input.launchProjectDir })
  if (!file.path) throw new Error('Launch-project config path is unavailable.')
  await writePhysicalReactiveFile({
    rootPath: input.launchProjectDir,
    relativePath: join('openspec', file.format === 'yml' ? 'config.yml' : 'config.yaml'),
    content: updateProjectBindingContent(file.content, input.update),
  })
  const writtenFile = await readPlanningYamlConfigFile({ rootPath: input.launchProjectDir })
  return {
    state: 'write-complete',
    owner: { kind: 'launch-project', path: input.launchProjectDir },
    file: writtenFile,
    binding: inspectProjectBinding(writtenFile.content),
    completedAt: Date.now(),
  }
}

/** Replace the CLI-selected environment-global configuration document. */
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

/** Set or explicitly clear only the official machine `defaultStore` field through the CLI. */
export async function writeEnvironmentDefaultStore(input: {
  cliExecutor: Pick<CliExecutor, 'execute'>
  update: EnvironmentDefaultStoreUpdate
}) {
  const args = input.update.value
    ? ['config', 'set', 'defaultStore', input.update.value, '--string']
    : ['config', 'unset', 'defaultStore']
  const result = await input.cliExecutor.execute(args)
  if (!result.success) {
    throw new Error(result.stderr || `OpenSpec ${args.slice(0, 3).join(' ')} failed.`)
  }
  return result
}

/** Read effective OpenSpec data scope from a successful or failed Root Context attempt. */
export function dataScopeFromRootPreview(state: RootContextResolvedState): OpenSpecDataScope {
  return currentRootContext(state).dataScope
}
