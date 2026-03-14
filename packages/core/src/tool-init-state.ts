import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { clearCache, reactiveExists } from './reactive-fs/index.js'
import { AI_TOOLS } from './tool-config.js'

export const TOOL_WORKFLOW_TO_SKILL_DIR = {
  propose: 'openspec-propose',
  explore: 'openspec-explore',
  new: 'openspec-new-change',
  continue: 'openspec-continue-change',
  apply: 'openspec-apply-change',
  ff: 'openspec-ff-change',
  sync: 'openspec-sync-specs',
  archive: 'openspec-archive-change',
  'bulk-archive': 'openspec-bulk-archive-change',
  verify: 'openspec-verify-change',
  onboard: 'openspec-onboard',
} as const

export type ToolWorkflowId = keyof typeof TOOL_WORKFLOW_TO_SKILL_DIR
export type ToolInitDelivery = 'both' | 'skills' | 'commands'
export type ToolInitStatus = 'uninitialized' | 'partial' | 'initialized'

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
}

interface ArtifactEntry {
  workflow: ToolWorkflowId
  path: string
}

const ALL_TOOL_WORKFLOWS = Object.keys(TOOL_WORKFLOW_TO_SKILL_DIR) as ToolWorkflowId[]

function toKnownWorkflows(workflows: readonly string[]): ToolWorkflowId[] {
  return workflows.filter(
    (workflow): workflow is ToolWorkflowId => workflow in TOOL_WORKFLOW_TO_SKILL_DIR
  )
}

function resolveCodexHome(): string {
  const configuredHome = process.env.CODEX_HOME?.trim()
  return resolve(configuredHome ? configuredHome : join(homedir(), '.codex'))
}

function resolveToolCommandPath(
  projectDir: string,
  toolId: string,
  workflow: ToolWorkflowId
): string | null {
  switch (toolId) {
    case 'amazon-q':
      return resolve(projectDir, '.amazonq', 'prompts', `opsx-${workflow}.md`)
    case 'antigravity':
      return resolve(projectDir, '.agent', 'workflows', `opsx-${workflow}.md`)
    case 'auggie':
      return resolve(projectDir, '.augment', 'commands', `opsx-${workflow}.md`)
    case 'claude':
      return resolve(projectDir, '.claude', 'commands', 'opsx', `${workflow}.md`)
    case 'cline':
      return resolve(projectDir, '.clinerules', 'workflows', `opsx-${workflow}.md`)
    case 'codebuddy':
      return resolve(projectDir, '.codebuddy', 'commands', 'opsx', `${workflow}.md`)
    case 'codex':
      return resolve(resolveCodexHome(), 'prompts', `opsx-${workflow}.md`)
    case 'continue':
      return resolve(projectDir, '.continue', 'prompts', `opsx-${workflow}.prompt`)
    case 'costrict':
      return resolve(projectDir, '.cospec', 'openspec', 'commands', `opsx-${workflow}.md`)
    case 'crush':
      return resolve(projectDir, '.crush', 'commands', 'opsx', `${workflow}.md`)
    case 'cursor':
      return resolve(projectDir, '.cursor', 'commands', `opsx-${workflow}.md`)
    case 'factory':
      return resolve(projectDir, '.factory', 'commands', `opsx-${workflow}.md`)
    case 'gemini':
      return resolve(projectDir, '.gemini', 'commands', 'opsx', `${workflow}.toml`)
    case 'github-copilot':
      return resolve(projectDir, '.github', 'prompts', `opsx-${workflow}.prompt.md`)
    case 'iflow':
      return resolve(projectDir, '.iflow', 'commands', `opsx-${workflow}.md`)
    case 'kilocode':
      return resolve(projectDir, '.kilocode', 'workflows', `opsx-${workflow}.md`)
    case 'kiro':
      return resolve(projectDir, '.kiro', 'prompts', `opsx-${workflow}.prompt.md`)
    case 'opencode':
      return resolve(projectDir, '.opencode', 'command', `opsx-${workflow}.md`)
    case 'pi':
      return resolve(projectDir, '.pi', 'prompts', `opsx-${workflow}.md`)
    case 'qoder':
      return resolve(projectDir, '.qoder', 'commands', 'opsx', `${workflow}.md`)
    case 'qwen':
      return resolve(projectDir, '.qwen', 'commands', `opsx-${workflow}.toml`)
    case 'roocode':
      return resolve(projectDir, '.roo', 'commands', `opsx-${workflow}.md`)
    case 'windsurf':
      return resolve(projectDir, '.windsurf', 'workflows', `opsx-${workflow}.md`)
    default:
      return null
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
    const path = resolveToolCommandPath(projectDir, toolId, workflow)
    return path ? [{ workflow, path }] : []
  })
}

function invalidateToolInitCaches(projectDir: string): void {
  const cacheRoots = new Set<string>()

  for (const tool of AI_TOOLS) {
    if (tool.skillsDir) {
      cacheRoots.add(resolve(projectDir, tool.skillsDir))
    }

    for (const workflow of ALL_TOOL_WORKFLOWS) {
      const commandPath = resolveToolCommandPath(projectDir, tool.value, workflow)
      if (commandPath) {
        cacheRoots.add(dirname(commandPath))
      }
    }
  }

  for (const root of cacheRoots) {
    clearCache(root)
  }
}

async function getExistingArtifactPaths(entries: readonly ArtifactEntry[]): Promise<Set<string>> {
  const presence = await Promise.all(
    entries.map(async (entry) => ({ path: entry.path, exists: await reactiveExists(entry.path) }))
  )
  return new Set(presence.filter((entry) => entry.exists).map((entry) => entry.path))
}

function countExisting(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): number {
  return entries.reduce((count, entry) => count + (existingPaths.has(entry.path) ? 1 : 0), 0)
}

function collectMissingWorkflows(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): ToolWorkflowId[] {
  return entries.filter((entry) => !existingPaths.has(entry.path)).map((entry) => entry.workflow)
}

function collectUnexpectedWorkflows(
  entries: readonly ArtifactEntry[],
  desiredWorkflowSet: ReadonlySet<ToolWorkflowId>,
  existingPaths: ReadonlySet<string>
): ToolWorkflowId[] {
  return entries
    .filter((entry) => !desiredWorkflowSet.has(entry.workflow) && existingPaths.has(entry.path))
    .map((entry) => entry.workflow)
}

export async function getToolInitStates(
  projectDir: string,
  options: { delivery: ToolInitDelivery; workflows: readonly string[] }
): Promise<ToolInitState[]> {
  invalidateToolInitCaches(projectDir)

  const desiredWorkflows = toKnownWorkflows(options.workflows)
  const desiredWorkflowSet = new Set(desiredWorkflows)
  const shouldGenerateSkills = options.delivery !== 'commands'
  const shouldGenerateCommands = options.delivery !== 'skills'

  return Promise.all(
    AI_TOOLS.filter((tool) => tool.skillsDir).map(async (tool) => {
      const skillArtifacts = getSkillArtifacts(projectDir, tool.skillsDir!)
      const commandArtifacts = getCommandArtifacts(projectDir, tool.value)
      const existingSkillPaths = await getExistingArtifactPaths(skillArtifacts)
      const existingCommandPaths = await getExistingArtifactPaths(commandArtifacts)

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
      } satisfies ToolInitState
    })
  )
}
