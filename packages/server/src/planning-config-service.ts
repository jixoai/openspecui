/**
 * Orthogonal intents (updated 2026-07-19 Asia/Shanghai):
 * 1. Read launch-project binding and active-root config from physically distinct roots.
 * 2. Project environment-global config, profile, and drift through one CLI-owned reactive read.
 * 3. Mutate only the explicitly selected ownership facet and refresh reactive caches.
 * 4. Return launch-file write evidence without waiting for Planning-root service convergence.
 *
 * Original request (2026-07-15): "Config ownership separates launch-project binding, active-root config, and environment-global config."
 * Original request (2026-07-18): "Profile/Drift must refresh with external environment config changes."
 * Derived requirement (2026-07-19): "Project Binding mutation uses write-then-converge settlement."
 */
import {
  EnvironmentGlobalConfigValueSchema,
  inspectProjectBinding,
  parseCliCommandResult,
  reactiveReadFile,
  updateProjectBindingContent,
  updateReactiveFileCache,
  writePhysicalReactiveFile,
  type ActiveRootConfig,
  type CliExecutor,
  type CliJsonValue,
  type EnvironmentGlobalConfig,
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

/** Read project-owned Store and Reference declarations from the launch project. */
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

/** Read configuration owned by the currently selected writable Planning root. */
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

/** Resolve and read the CLI-selected environment-global configuration file. */
export async function readEnvironmentGlobalConfig(input: {
  dataScope: OpenSpecDataScope
  cliExecutor: CliExecutor
}): Promise<EnvironmentGlobalConfig> {
  const [pathEvidence, configResult, driftEvidence] = await Promise.all([
    input.cliExecutor.execute(['config', 'path']),
    input.cliExecutor.execute(['config', 'list', '--json']),
    input.cliExecutor.execute(['config', 'list']),
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
  const file = await readProjectConfigFile({ rootPath: input.launchProjectDir })
  if (!file.path) throw new Error('Launch-project config path is unavailable.')
  await writePhysicalReactiveFile({
    rootPath: input.launchProjectDir,
    relativePath: join('openspec', file.format === 'yml' ? 'config.yml' : 'config.yaml'),
    content: updateProjectBindingContent(file.content, input.update),
  })
  const writtenFile = await readProjectConfigFile({ rootPath: input.launchProjectDir })
  return {
    state: 'write-complete',
    owner: { kind: 'launch-project', path: input.launchProjectDir },
    file: writtenFile,
    binding: inspectProjectBinding(writtenFile.content),
    completedAt: Date.now(),
  }
}

/** Replace the active Planning-root configuration through its reactive file owner. */
export async function writeActiveRootConfig(input: {
  launchProjectDir: string
  rootContext: RootContext
  content: string
}): Promise<void> {
  const active = await readActiveRootConfig(input)
  if (!active.file.path) throw new Error('Active-root config path is unavailable.')
  await writeConfigFile(active.file.path, input.content)
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

/** Read effective OpenSpec data scope from a successful or failed Root Context attempt. */
export function dataScopeFromRootPreview(state: RootContextResolvedState): OpenSpecDataScope {
  return currentRootContext(state).dataScope
}
