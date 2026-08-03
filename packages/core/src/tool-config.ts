/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Expose the unified OpenSpec 1.7 Agent delivery registry through the established Tool APIs.
 * 2. Detect configured project-local Agent roots reactively without duplicating registry metadata.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 */

import { join, resolve } from 'node:path'
import { AI_TOOLS, resolveAgentToolId, type ToolConfig } from './agent-delivery-registry.js'
import { ReactiveState, acquireWatcher, reactiveExists, reactiveStat } from './reactive-fs/index.js'

export {
  AGENT_DELIVERY_REGISTRY,
  AI_TOOLS,
  resolveAgentToolId,
  type AIToolOption,
  type AgentCommandArtifact,
  type AgentCommandContentFormat,
  type AgentCommandFormat,
  type AgentCommandInvocationStyle,
  type AgentCommandSurfaceCapability,
  type AgentDeliveryCleanup,
  type AgentDeliveryMigration,
  type ToolConfig,
} from './agent-delivery-registry.js'

/** OpenSpec initialization generated skill directory names. */
export const SKILL_NAMES = [
  'openspec-explore',
  'openspec-new-change',
  'openspec-continue-change',
  'openspec-apply-change',
  'openspec-update-change',
  'openspec-ff-change',
  'openspec-sync-specs',
  'openspec-archive-change',
  'openspec-bulk-archive-change',
  'openspec-verify-change',
  'openspec-onboard',
  'openspec-propose',
] as const

/** Return registry entries available to OpenSpec init/update. */
export function getAvailableTools(): ToolConfig[] {
  return AI_TOOLS.filter((tool) => tool.available)
}

/** Return available official Tool ids. */
export function getAvailableToolIds(): string[] {
  return getAvailableTools().map((tool) => tool.value)
}

/** Return the complete official registry, including unavailable pseudo-tools. */
export function getAllTools(): ToolConfig[] {
  return AI_TOOLS
}

/** Detect project-local Agent roots using the official OpenSpec detection paths. */
export async function getDetectedProjectTools(projectDir: string): Promise<ToolConfig[]> {
  const results = await Promise.all(
    AI_TOOLS.map(async (tool) => {
      if (!tool.skillsDir) return null
      if (tool.detectionPaths?.length) {
        const detected = await Promise.all(
          tool.detectionPaths.map((detectionPath) => reactiveStat(join(projectDir, detectionPath)))
        )
        return detected.some((entry) => entry !== null) ? tool : null
      }
      const toolRoot = await reactiveStat(join(projectDir, tool.skillsDir))
      return toolRoot?.isDirectory === true ? tool : null
    })
  )
  return results.filter((tool): tool is ToolConfig => tool !== null)
}

/** Return every current official Tool id in registry order. */
export function getAllToolIds(): string[] {
  return AI_TOOLS.map((tool) => tool.value)
}

/** Resolve one current or retired Tool id to its official registry entry. */
export function getToolById(toolId: string): ToolConfig | undefined {
  const resolvedToolId = resolveAgentToolId(toolId)
  return AI_TOOLS.find((tool) => tool.value === resolvedToolId)
}

const stateCache = new Map<string, ReactiveState<string[]>>()
const releaseCache = new Map<string, () => void>()

function getSkillsDir(projectDir: string, tool: ToolConfig): string | null {
  return tool.skillsDir ? join(projectDir, tool.skillsDir, 'skills') : null
}

async function getSkillCount(projectDir: string, tool: ToolConfig): Promise<number> {
  const skillsDir = getSkillsDir(projectDir, tool)
  if (!skillsDir) return 0

  let count = 0
  for (const skillName of SKILL_NAMES) {
    if (await reactiveExists(join(skillsDir, skillName, 'SKILL.md'))) count++
  }
  return count
}

async function scanConfiguredTools(projectDir: string): Promise<string[]> {
  const results = await Promise.all(
    AI_TOOLS.map(async (tool) => {
      if (!tool.skillsDir) return null
      return (await getSkillCount(projectDir, tool)) > 0 ? tool.value : null
    })
  )
  return results.filter((toolId): toolId is string => toolId !== null)
}

function getProjectWatchDirs(projectDir: string): string[] {
  const dirs = new Set<string>()
  for (const tool of AI_TOOLS) {
    if (tool.skillsDir) dirs.add(join(projectDir, tool.skillsDir))
    for (const migration of tool.migrations ?? []) dirs.add(join(projectDir, migration.from))
  }
  return [...dirs]
}

/** Detect configured Agents through a retained reactive projection. */
export async function getConfiguredTools(projectDir: string): Promise<string[]> {
  const normalizedPath = resolve(projectDir)
  const key = `tools:${normalizedPath}`
  let state = stateCache.get(key)

  if (!state) {
    state = new ReactiveState<string[]>(await scanConfiguredTools(normalizedPath), {
      equals: (left, right) =>
        left.length === right.length && left.every((value, index) => value === right[index]),
    })
    stateCache.set(key, state)

    const releases: (() => void)[] = []
    const onUpdate = async () => state?.set(await scanConfiguredTools(normalizedPath))
    for (const dir of getProjectWatchDirs(normalizedPath)) {
      releases.push(acquireWatcher(dir, onUpdate, { recursive: true }))
    }
    releases.push(acquireWatcher(normalizedPath, onUpdate, { recursive: false }))
    releaseCache.set(key, () => releases.forEach((release) => release()))
  }

  return state.get()
}

/** Check whether a current or retired Tool id resolves to configured skills. */
export async function isToolConfigured(projectDir: string, toolId: string): Promise<boolean> {
  const configured = await getConfiguredTools(projectDir)
  return configured.includes(resolveAgentToolId(toolId))
}
