/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Resolve the running OpenSpec CLI's private command-generation boundary without bundling copied prompts.
 * 2. Produce exact per-Agent, per-workflow command contents for physical fingerprint comparison.
 * 3. Fail closed when the configured runner has no importable OpenSpec module or compatible generator contract.
 * 4. Isolate per-tool adapter absence as version-scoped unavailability, keeping unrelated evidence.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 */

import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { AGENT_DELIVERY_REGISTRY } from './agent-delivery-registry.js'
import { resolveOpenSpecWorkerInvocation } from './openspec-cli-worker.js'
import { OPSX_ALL_WORKFLOWS, type OpsxWorkflowId } from './opsx-workflows.js'

/** Exact generated command contents keyed by official Agent id and OPSX workflow id. */
export type AgentCommandContentCatalog = Readonly<
  Record<string, Readonly<Partial<Record<OpsxWorkflowId, string>>>>
>

/**
 * Command-generation evidence for one CLI runner.
 *
 * `unavailableTools` isolates tools whose command adapter this CLI line never shipped (for
 * example Command Code on OpenSpec 1.8): the tool is unavailable with a version-scoped
 * reason while every independently supported adapter's evidence stays available. The whole
 * result is null only when the runner has no importable generator boundary at all.
 */
export interface AgentCommandContentResult {
  catalog: AgentCommandContentCatalog
  unavailableTools: Readonly<Record<string, string>>
}

interface RuntimeCommandContent {
  id: OpsxWorkflowId
}

interface RuntimeGeneratedCommand {
  fileContent: string
}

interface RuntimeSkillGenerationModule {
  getCommandContents(workflows: readonly string[]): unknown
}

interface RuntimeCommandAdapterRegistry {
  get(toolId: string): unknown
}

interface RuntimeCommandGenerationModule {
  CommandAdapterRegistry: RuntimeCommandAdapterRegistry
  generateCommands(contents: readonly RuntimeCommandContent[], adapter: unknown): unknown
}

const KNOWN_WORKFLOWS = new Set<string>(OPSX_ALL_WORKFLOWS)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isRuntimeSkillGenerationModule(value: unknown): value is RuntimeSkillGenerationModule {
  return isRecord(value) && typeof value.getCommandContents === 'function'
}

function isRuntimeCommandAdapterRegistry(value: unknown): value is RuntimeCommandAdapterRegistry {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) return false
  return 'get' in value && typeof value.get === 'function'
}

function isRuntimeCommandGenerationModule(value: unknown): value is RuntimeCommandGenerationModule {
  return (
    isRecord(value) &&
    isRuntimeCommandAdapterRegistry(value.CommandAdapterRegistry) &&
    typeof value.generateCommands === 'function'
  )
}

function isRuntimeCommandContent(value: unknown): value is RuntimeCommandContent {
  return isRecord(value) && typeof value.id === 'string' && KNOWN_WORKFLOWS.has(value.id)
}

function isRuntimeGeneratedCommand(value: unknown): value is RuntimeGeneratedCommand {
  return isRecord(value) && typeof value.fileContent === 'string'
}

/**
 * Load exact command contents from the configured OpenSpec CLI.
 *
 * The private generator is intentionally treated as optional evidence. When the runner is not an
 * importable local OpenSpec module, callers receive `null` and commands-only installs cannot be
 * declared current from path existence alone.
 */
export async function loadOpenSpecAgentCommandContents(
  cliCommand: readonly string[],
  workflows: readonly string[]
): Promise<AgentCommandContentResult | null> {
  try {
    const invocation = await resolveOpenSpecWorkerInvocation(cliCommand)
    const cliModuleDir = dirname(invocation.modulePath)
    const [skillGenerationModule, commandGenerationModule]: [unknown, unknown] = await Promise.all([
      import(pathToFileURL(resolve(cliModuleDir, '../core/shared/skill-generation.js')).href),
      import(pathToFileURL(resolve(cliModuleDir, '../core/command-generation/index.js')).href),
    ])
    if (
      !isRuntimeSkillGenerationModule(skillGenerationModule) ||
      !isRuntimeCommandGenerationModule(commandGenerationModule)
    ) {
      return null
    }

    const commandContents = skillGenerationModule.getCommandContents(workflows)
    if (!Array.isArray(commandContents) || !commandContents.every(isRuntimeCommandContent)) {
      return null
    }

    const catalog: Record<string, Partial<Record<OpsxWorkflowId, string>>> = {}
    const unavailableTools: Record<string, string> = {}
    for (const tool of AGENT_DELIVERY_REGISTRY) {
      if (!tool.command) continue
      const adapter = commandGenerationModule.CommandAdapterRegistry.get(tool.value)
      if (!adapter) {
        // This CLI line never shipped the tool's command adapter. Isolate the tool as
        // version-scoped unavailable evidence instead of erasing every other adapter's
        // generated command evidence.
        unavailableTools[tool.value] =
          tool.minCliSeries !== undefined
            ? `Command adapter first ships with OpenSpec CLI ${tool.minCliSeries}; this runner does not declare it.`
            : 'This OpenSpec CLI runner does not register the command adapter.'
        continue
      }
      const generatedCommands = commandGenerationModule.generateCommands(commandContents, adapter)
      if (
        !Array.isArray(generatedCommands) ||
        generatedCommands.length !== commandContents.length ||
        !generatedCommands.every(isRuntimeGeneratedCommand)
      ) {
        return null
      }
      catalog[tool.value] = Object.fromEntries(
        commandContents.map((content, index) => [content.id, generatedCommands[index]?.fileContent])
      )
    }
    return { catalog, unavailableTools }
  } catch {
    return null
  }
}
