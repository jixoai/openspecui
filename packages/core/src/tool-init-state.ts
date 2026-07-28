/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Map official OPSX workflows to generated skill and command locations.
 * 2. Project launch-local skills and physically scoped tool command initialization state.
 * 3. Provide the runtime owner with the same external Codex command root used by command projection.
 * 4. Bound reactive observation through existing parent inventories while preserving fresh one-shot reads.
 *
 * Original request (2026-07-15): "sync、update、Oh My Pi、Trae 的完整交付链。"
 * Remote CI fixed point (2026-07-28): Launch-local skill creation must converge when its tool root was absent at initial projection.
 */
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import {
  OPSX_ALL_WORKFLOWS,
  OPSX_WORKFLOW_TO_SKILL_DIR as TOOL_WORKFLOW_TO_SKILL_DIR,
  type OpsxWorkflowId,
} from './opsx-workflows.js'
import { clearCache, reactiveReadDir } from './reactive-fs/index.js'
import { AI_TOOLS } from './tool-config.js'

export { TOOL_WORKFLOW_TO_SKILL_DIR }
export type ToolWorkflowId = OpsxWorkflowId
export type ToolInitDelivery = 'both' | 'skills' | 'commands'
export type ToolInitStatus = 'uninitialized' | 'partial' | 'initialized'

/** Return the external runtime directory containing official Codex command prompts. */
export function getExternalCodexCommandObservationRoot(): string {
  return join(resolveCodexHome(), 'prompts')
}

export interface ToolInitState {
  toolId: string
  toolName: string
  status: ToolInitStatus
  hasAnyArtifacts: boolean
  expectedSkillCount: number
  presentExpectedSkillCount: number
  detectedSkillCount: number
  expectedCommandCount: number
  presentExpectedCommandCount: number
  detectedCommandCount: number
  missingSkillWorkflows: ToolWorkflowId[]
  missingCommandWorkflows: ToolWorkflowId[]
  unexpectedSkillWorkflows: ToolWorkflowId[]
  unexpectedCommandWorkflows: ToolWorkflowId[]
  legacyCommandWorkflows: ToolWorkflowId[]
}

interface ArtifactEntry {
  workflow: ToolWorkflowId
  path: string
  legacyPaths?: readonly string[]
}

const ALL_TOOL_WORKFLOWS = [...OPSX_ALL_WORKFLOWS]

type CommandPathResolver = (projectDir: string, workflow: ToolWorkflowId) => string

interface ToolCommandPathConfig {
  primary: CommandPathResolver
  legacy?: readonly CommandPathResolver[]
}

function toKnownWorkflows(workflows: readonly string[]): ToolWorkflowId[] {
  return workflows.filter(
    (workflow): workflow is ToolWorkflowId => workflow in TOOL_WORKFLOW_TO_SKILL_DIR
  )
}

function resolveCodexHome(): string {
  const configuredHome = process.env.CODEX_HOME?.trim()
  return resolve(configuredHome ? configuredHome : join(homedir(), '.codex'))
}

const TOOL_COMMAND_PATHS: Record<string, ToolCommandPathConfig> = {
  'amazon-q': {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.amazonq', 'prompts', `opsx-${workflow}.md`),
  },
  antigravity: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.agent', 'workflows', `opsx-${workflow}.md`),
  },
  auggie: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.augment', 'commands', `opsx-${workflow}.md`),
  },
  bob: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.bob', 'commands', `opsx-${workflow}.md`),
  },
  claude: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.claude', 'commands', 'opsx', `${workflow}.md`),
  },
  cline: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.clinerules', 'workflows', `opsx-${workflow}.md`),
  },
  codebuddy: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.codebuddy', 'commands', 'opsx', `${workflow}.md`),
  },
  codex: {
    primary: (_projectDir, workflow) =>
      resolve(resolveCodexHome(), 'prompts', `opsx-${workflow}.md`),
  },
  continue: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.continue', 'prompts', `opsx-${workflow}.prompt`),
  },
  costrict: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.cospec', 'openspec', 'commands', `opsx-${workflow}.md`),
  },
  crush: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.crush', 'commands', 'opsx', `${workflow}.md`),
  },
  cursor: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.cursor', 'commands', `opsx-${workflow}.md`),
  },
  factory: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.factory', 'commands', `opsx-${workflow}.md`),
  },
  gemini: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.gemini', 'commands', 'opsx', `${workflow}.toml`),
  },
  'github-copilot': {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.github', 'prompts', `opsx-${workflow}.prompt.md`),
  },
  iflow: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.iflow', 'commands', `opsx-${workflow}.md`),
  },
  junie: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.junie', 'commands', `opsx-${workflow}.md`),
  },
  kilocode: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.kilocode', 'workflows', `opsx-${workflow}.md`),
  },
  kiro: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.kiro', 'prompts', `opsx-${workflow}.prompt.md`),
  },
  lingma: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.lingma', 'commands', 'opsx', `${workflow}.md`),
  },
  opencode: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.opencode', 'commands', `opsx-${workflow}.md`),
    legacy: [
      (projectDir, workflow) => resolve(projectDir, '.opencode', 'command', `opsx-${workflow}.md`),
    ],
  },
  'oh-my-pi': {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.omp', 'commands', `opsx-${workflow}.md`),
  },
  pi: {
    primary: (projectDir, workflow) => resolve(projectDir, '.pi', 'prompts', `opsx-${workflow}.md`),
  },
  qoder: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.qoder', 'commands', 'opsx', `${workflow}.md`),
  },
  qwen: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.qwen', 'commands', `opsx-${workflow}.toml`),
  },
  roocode: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.roo', 'commands', `opsx-${workflow}.md`),
  },
  trae: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.trae', 'commands', `opsx-${workflow}.md`),
  },
  windsurf: {
    primary: (projectDir, workflow) =>
      resolve(projectDir, '.windsurf', 'workflows', `opsx-${workflow}.md`),
  },
}

function resolveToolCommandArtifact(
  projectDir: string,
  toolId: string,
  workflow: ToolWorkflowId
): ArtifactEntry | null {
  const config = TOOL_COMMAND_PATHS[toolId]
  if (!config) return null
  return {
    workflow,
    path: config.primary(projectDir, workflow),
    legacyPaths: config.legacy?.map((resolvePath) => resolvePath(projectDir, workflow)),
  }
}

function getSkillArtifacts(projectDir: string, skillsDir: string): ArtifactEntry[] {
  return ALL_TOOL_WORKFLOWS.map((workflow) => ({
    workflow,
    path: resolve(
      projectDir,
      skillsDir,
      'skills',
      TOOL_WORKFLOW_TO_SKILL_DIR[workflow],
      'SKILL.md'
    ),
  }))
}

function getCommandArtifacts(projectDir: string, toolId: string): ArtifactEntry[] {
  return ALL_TOOL_WORKFLOWS.flatMap((workflow) => {
    const artifact = resolveToolCommandArtifact(projectDir, toolId, workflow)
    return artifact ? [artifact] : []
  })
}

function invalidateToolInitCaches(projectDir: string): void {
  const cacheRoots = new Set<string>([resolve(projectDir)])

  for (const tool of AI_TOOLS) {
    if (tool.skillsDir) {
      cacheRoots.add(resolve(projectDir, tool.skillsDir))
    }

    for (const commandArtifact of getCommandArtifacts(projectDir, tool.value)) {
      cacheRoots.add(dirname(commandArtifact.path))
      for (const legacyPath of commandArtifact.legacyPaths ?? []) {
        cacheRoots.add(dirname(legacyPath))
      }
    }
  }

  for (const root of cacheRoots) {
    clearCache(root)
  }
}

async function readArtifactDirectory(dir: string): Promise<ReadonlySet<string>> {
  return new Set(await reactiveReadDir(dir, { includeHidden: true }))
}

async function getExistingSkillPaths(
  projectDir: string,
  skillsDir: string,
  entries: readonly ArtifactEntry[],
  projectRootEntries: ReadonlySet<string>
): Promise<Set<string>> {
  const toolRoot = resolve(projectDir, skillsDir)
  if (!projectRootEntries.has(basename(toolRoot))) return new Set()

  const toolRootEntries = await readArtifactDirectory(toolRoot)
  if (!toolRootEntries.has('skills')) return new Set()

  const inventoryRoot = resolve(toolRoot, 'skills')
  const rootEntries = await readArtifactDirectory(inventoryRoot)
  const presentEntries = entries.filter((entry) => rootEntries.has(basename(dirname(entry.path))))
  const directoryEntries = await Promise.all(
    presentEntries.map(async (entry) => ({
      entry,
      files: await readArtifactDirectory(dirname(entry.path)),
    }))
  )

  return new Set(
    directoryEntries
      .filter(({ entry, files }) => files.has(basename(entry.path)))
      .map(({ entry }) => entry.path)
  )
}

async function getExistingCommandPaths(entries: readonly ArtifactEntry[]): Promise<Set<string>> {
  const pathsByDirectory = new Map<string, string[]>()
  for (const entry of entries) {
    for (const path of [entry.path, ...(entry.legacyPaths ?? [])]) {
      const directory = dirname(path)
      const paths = pathsByDirectory.get(directory) ?? []
      paths.push(path)
      pathsByDirectory.set(directory, paths)
    }
  }

  const directoryEntries = await Promise.all(
    [...pathsByDirectory].map(async ([directory, paths]) => ({
      paths,
      files: await readArtifactDirectory(directory),
    }))
  )

  return new Set(
    directoryEntries.flatMap(({ paths, files }) =>
      paths.filter((path) => files.has(basename(path)))
    )
  )
}

function hasExistingArtifact(entry: ArtifactEntry, existingPaths: ReadonlySet<string>): boolean {
  return (
    existingPaths.has(entry.path) ||
    (entry.legacyPaths?.some((legacyPath) => existingPaths.has(legacyPath)) ?? false)
  )
}

function hasLegacyArtifact(entry: ArtifactEntry, existingPaths: ReadonlySet<string>): boolean {
  return entry.legacyPaths?.some((legacyPath) => existingPaths.has(legacyPath)) ?? false
}

function countExisting(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): number {
  return entries.reduce(
    (count, entry) => count + (hasExistingArtifact(entry, existingPaths) ? 1 : 0),
    0
  )
}

function collectMissingWorkflows(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): ToolWorkflowId[] {
  return entries
    .filter((entry) => !hasExistingArtifact(entry, existingPaths))
    .map((entry) => entry.workflow)
}

function collectUnexpectedWorkflows(
  entries: readonly ArtifactEntry[],
  desiredWorkflowSet: ReadonlySet<ToolWorkflowId>,
  existingPaths: ReadonlySet<string>
): ToolWorkflowId[] {
  return entries
    .filter(
      (entry) =>
        !desiredWorkflowSet.has(entry.workflow) && hasExistingArtifact(entry, existingPaths)
    )
    .map((entry) => entry.workflow)
}

function collectLegacyWorkflows(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): ToolWorkflowId[] {
  return entries
    .filter((entry) => hasLegacyArtifact(entry, existingPaths))
    .map((entry) => entry.workflow)
}

async function projectToolInitStates(
  projectDir: string,
  options: { delivery: ToolInitDelivery; workflows: readonly string[] }
): Promise<ToolInitState[]> {
  const desiredWorkflows = toKnownWorkflows(options.workflows)
  const desiredWorkflowSet = new Set(desiredWorkflows)
  const shouldGenerateSkills = options.delivery !== 'commands'
  const shouldGenerateCommands = options.delivery !== 'skills'
  const projectRootEntries = await readArtifactDirectory(projectDir)

  return Promise.all(
    AI_TOOLS.filter((tool) => tool.skillsDir).map(async (tool) => {
      const skillArtifacts = getSkillArtifacts(projectDir, tool.skillsDir!)
      const commandArtifacts = getCommandArtifacts(projectDir, tool.value)
      const existingSkillPaths = await getExistingSkillPaths(
        projectDir,
        tool.skillsDir!,
        skillArtifacts,
        projectRootEntries
      )
      const existingCommandPaths = await getExistingCommandPaths(commandArtifacts)

      const expectedSkillArtifacts = shouldGenerateSkills
        ? skillArtifacts.filter((entry) => desiredWorkflowSet.has(entry.workflow))
        : []
      const expectedCommandArtifacts = shouldGenerateCommands
        ? commandArtifacts.filter((entry) => desiredWorkflowSet.has(entry.workflow))
        : []

      const missingSkillWorkflows = collectMissingWorkflows(
        expectedSkillArtifacts,
        existingSkillPaths
      )
      const missingCommandWorkflows = collectMissingWorkflows(
        expectedCommandArtifacts,
        existingCommandPaths
      )
      const unexpectedSkillWorkflows = collectUnexpectedWorkflows(
        shouldGenerateSkills ? skillArtifacts : skillArtifacts,
        shouldGenerateSkills ? desiredWorkflowSet : new Set<ToolWorkflowId>(),
        existingSkillPaths
      )
      const unexpectedCommandWorkflows = collectUnexpectedWorkflows(
        shouldGenerateCommands ? commandArtifacts : commandArtifacts,
        shouldGenerateCommands ? desiredWorkflowSet : new Set<ToolWorkflowId>(),
        existingCommandPaths
      )
      const legacyCommandWorkflows = collectLegacyWorkflows(commandArtifacts, existingCommandPaths)

      const expectedSkillCount = expectedSkillArtifacts.length
      const presentExpectedSkillCount = expectedSkillCount - missingSkillWorkflows.length
      const detectedSkillCount = countExisting(skillArtifacts, existingSkillPaths)

      const expectedCommandCount = expectedCommandArtifacts.length
      const presentExpectedCommandCount = expectedCommandCount - missingCommandWorkflows.length
      const detectedCommandCount = countExisting(commandArtifacts, existingCommandPaths)

      const hasAnyArtifacts = detectedSkillCount + detectedCommandCount > 0
      const isInitialized =
        missingSkillWorkflows.length === 0 &&
        missingCommandWorkflows.length === 0 &&
        unexpectedSkillWorkflows.length === 0 &&
        unexpectedCommandWorkflows.length === 0

      return {
        toolId: tool.value,
        toolName: tool.name,
        status: !hasAnyArtifacts ? 'uninitialized' : isInitialized ? 'initialized' : 'partial',
        hasAnyArtifacts,
        expectedSkillCount,
        presentExpectedSkillCount,
        detectedSkillCount,
        expectedCommandCount,
        presentExpectedCommandCount,
        detectedCommandCount,
        missingSkillWorkflows,
        missingCommandWorkflows,
        unexpectedSkillWorkflows,
        unexpectedCommandWorkflows,
        legacyCommandWorkflows,
      } satisfies ToolInitState
    })
  )
}

/** Read a fresh one-shot Project Tool artifact inventory. */
export async function getToolInitStates(
  projectDir: string,
  options: { delivery: ToolInitDelivery; workflows: readonly string[] }
): Promise<ToolInitState[]> {
  invalidateToolInitCaches(projectDir)
  return projectToolInitStates(projectDir, options)
}

/** Create a retained Tool inventory task that must be executed by one ReactiveContext. */
export function createToolInitStateProjection(
  projectDir: string,
  options: { delivery: ToolInitDelivery; workflows: readonly string[] }
): () => Promise<ToolInitState[]> {
  const projectionOptions = {
    delivery: options.delivery,
    workflows: [...options.workflows],
  } satisfies { delivery: ToolInitDelivery; workflows: readonly string[] }
  return () => projectToolInitStates(projectDir, projectionOptions)
}
