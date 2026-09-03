/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Project the unified OpenSpec 1.12 Agent registry into exact skill and command artifact state.
 * 2. Report partial, stale-version, cleanup-needed, migration-required, and unavailable states from physical evidence.
 * 3. Observe user-global skill roots (e.g. MiniMax Code) without ever cleaning or migrating them here.
 * 4. Preserve bounded reactive directory observation and fresh one-shot cache invalidation.
 * 5. Expose Codex managed-global-prompt observation without treating those prompts as current commands.
 * 6. Judge generated-by staleness series-aware: only the admitted line (stable 1.12.x) is
 *    current; below-admitted generators (1.11.x, 1.10.x, and older) and unparseable
 *    stamps are stale.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */

import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import {
  isEquivalentAgentCommandContent,
  type AgentCommandContentCatalog,
} from './agent-command-content.js'
import {
  AI_TOOLS,
  parseOpenSpecCliSeries,
  resolveAgentCommandPathTemplate,
  type AgentManagedGlobalPromptCleanup,
  type AgentProjectCleanup,
  type ToolConfig,
} from './agent-delivery-registry.js'
import {
  OPSX_ALL_WORKFLOWS,
  OPSX_WORKFLOW_TO_SKILL_DIR as TOOL_WORKFLOW_TO_SKILL_DIR,
  type OpsxWorkflowId,
} from './opsx-workflows.js'
import { clearCache, reactiveReadDir, reactiveReadFile } from './reactive-fs/index.js'

export { TOOL_WORKFLOW_TO_SKILL_DIR }
export type ToolWorkflowId = OpsxWorkflowId
export type ToolInitDelivery = 'both' | 'skills' | 'commands'
export type ToolInitStatus =
  | 'unavailable'
  | 'uninitialized'
  | 'partial'
  | 'initialized'
  | 'stale-version'
  | 'cleanup-needed'
  | 'migration-required'

export type ToolInitReadiness = 'unavailable' | 'uninitialized' | 'partial' | 'initialized'
export type ToolInitIssue = 'stale-version' | 'cleanup-needed' | 'migration-required'

/** Pinned source version used when a runtime CLI version is not supplied by the Server owner. */
export const PINNED_AGENT_GENERATOR_VERSION = '1.12.0'

/** Physical delivery scope of one tool's skills inventory. */
export type ToolSkillsScope =
  | { kind: 'project'; skillsDir: string }
  | { kind: 'user-global'; globalSkillsDir: string }
  | { kind: 'none' }

/** Resolve the physical skills inventory scope for one registry entry. */
export function resolveToolSkillsScope(tool: ToolConfig): ToolSkillsScope {
  if (tool.globalSkillsDir) return { kind: 'user-global', globalSkillsDir: tool.globalSkillsDir }
  if (tool.skillsDir) return { kind: 'project', skillsDir: tool.skillsDir }
  return { kind: 'none' }
}

/** Resolve the home directory the same way the official CLI resolves user-global roots. */
function resolveAgentHome(): string {
  return process.env.USERPROFILE || process.env.HOME || homedir()
}

/** Resolve the absolute user-global skills inventory directory for a global root (e.g. `.minimax`). */
export function resolveGlobalSkillsInventoryDir(globalSkillsDir: string): string {
  return resolve(resolveAgentHome(), globalSkillsDir, 'skills')
}

/** External user-global skills inventory roots observed by the Agent delivery projection. */
export function getExternalAgentSkillsObservationRoots(): string[] {
  return AI_TOOLS.flatMap((tool) => {
    if (!tool.globalSkillsDir) return []
    const root = resolveGlobalSkillsInventoryDir(tool.globalSkillsDir)
    return root === getExternalCodexCommandObservationRoot() ? [] : [root]
  })
}

export interface ToolInitCleanupState {
  required: boolean
  kind: 'managed-global-prompts' | 'project-artifacts' | 'mixed'
  paths: string[]
  workflows: ToolWorkflowId[]
  replacementLabel: string
}

export interface ToolInitMigrationState {
  from: string
  to: string
  needsConsent: boolean
  workflows: ToolWorkflowId[]
  skillFiles: number
  commandFiles: number
}

export interface ToolInitState {
  toolId: string
  toolName: string
  status: ToolInitStatus
  readiness: ToolInitReadiness
  issues: ToolInitIssue[]
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
  installedSkillWorkflows: ToolWorkflowId[]
  installedCommandWorkflows: ToolWorkflowId[]
  generatedByVersion: string | null
  /** Physical delivery scope of this tool's skills; global roots are observed, never mutated here. */
  skillsScope: ToolSkillsScope
  /** Former project roots still carrying OpenSpec-managed skills (Codex `.codex`). */
  legacySkillRoots: string[]
  /** Declared upstream: the tool needs an IDE/editor restart to load regenerated artifacts. */
  requiresIdeRestart: boolean
  /** Version-scoped reason when this CLI line never shipped the tool's command adapter. */
  commandSurfaceUnavailableReason: string | null
  cleanup?: ToolInitCleanupState
  migration?: ToolInitMigrationState
}

interface ArtifactEntry {
  workflow: ToolWorkflowId
  path: string
  legacyPaths?: readonly string[]
}

interface MigrationEvidence {
  state: ToolInitMigrationState
  skillPaths: ReadonlySet<string>
  commandPaths: ReadonlySet<string>
  skillArtifacts: readonly ArtifactEntry[]
  commandArtifacts: readonly ArtifactEntry[]
}

export interface ToolInitProjectionOptions {
  delivery: ToolInitDelivery
  workflows: readonly string[]
  generatorVersion?: string
  commandContents?: AgentCommandContentCatalog | null
  /** Tools whose command adapter this CLI line never shipped, with version-scoped reasons. */
  unavailableCommandTools?: Readonly<Record<string, string>> | null
  /**
   * Official inventory for the admitted CLI line. Defaults to the newest supported registry;
   * the Agent delivery projection passes the version-selected list so each admitted session
   * reports only its own tools' states (no later-line restart facts, no unshipped targets).
   */
  registry?: readonly ToolConfig[]
}

const ALL_TOOL_WORKFLOWS = [...OPSX_ALL_WORKFLOWS]

function toKnownWorkflows(workflows: readonly string[]): ToolWorkflowId[] {
  return workflows.filter(
    (workflow): workflow is ToolWorkflowId => workflow in TOOL_WORKFLOW_TO_SKILL_DIR
  )
}

function resolveCodexHome(): string {
  const configuredHome = process.env.CODEX_HOME?.trim()
  return resolve(configuredHome ? configuredHome : join(homedir(), '.codex'))
}

/** Return the external directory containing allowlisted managed legacy Codex prompts. */
export function getExternalCodexCommandObservationRoot(): string {
  return join(resolveCodexHome(), 'prompts')
}

function resolveCommandArtifact(
  projectDir: string,
  tool: ToolConfig,
  workflow: ToolWorkflowId,
  rootOverride?: string
): ArtifactEntry | null {
  if (!tool.command) return null
  const rebase = (pathTemplate: string): string => {
    if (!rootOverride || !tool.skillsDir || !pathTemplate.startsWith(`${tool.skillsDir}/`)) {
      return pathTemplate
    }
    return `${rootOverride}${pathTemplate.slice(tool.skillsDir.length)}`
  }
  return {
    workflow,
    path: resolve(
      projectDir,
      resolveAgentCommandPathTemplate(rebase(tool.command.pathTemplate), workflow)
    ),
    legacyPaths: tool.command.legacyPathTemplates?.map((pathTemplate) =>
      resolve(projectDir, resolveAgentCommandPathTemplate(rebase(pathTemplate), workflow))
    ),
  }
}

function getSkillArtifactsFromInventory(
  inventoryRoot: string,
  workflows: readonly ToolWorkflowId[] = ALL_TOOL_WORKFLOWS
): ArtifactEntry[] {
  return workflows.map((workflow) => ({
    workflow,
    path: resolve(inventoryRoot, TOOL_WORKFLOW_TO_SKILL_DIR[workflow], 'SKILL.md'),
  }))
}

function getSkillArtifacts(
  projectDir: string,
  skillsDir: string,
  workflows: readonly ToolWorkflowId[] = ALL_TOOL_WORKFLOWS
): ArtifactEntry[] {
  return getSkillArtifactsFromInventory(resolve(projectDir, skillsDir, 'skills'), workflows)
}

function getCommandArtifacts(
  projectDir: string,
  tool: ToolConfig,
  rootOverride?: string
): ArtifactEntry[] {
  return ALL_TOOL_WORKFLOWS.flatMap((workflow) => {
    const artifact = resolveCommandArtifact(projectDir, tool, workflow, rootOverride)
    return artifact ? [artifact] : []
  })
}

function invalidateToolInitCaches(projectDir: string): void {
  const cacheRoots = new Set<string>([
    resolve(projectDir),
    getExternalCodexCommandObservationRoot(),
    ...getExternalAgentSkillsObservationRoots(),
  ])
  for (const tool of AI_TOOLS) {
    if (tool.skillsDir) cacheRoots.add(resolve(projectDir, tool.skillsDir))
    for (const legacyRoot of tool.legacySkillsDirs ?? [])
      cacheRoots.add(resolve(projectDir, legacyRoot))
    for (const migration of tool.migrations ?? [])
      cacheRoots.add(resolve(projectDir, migration.from))
    for (const commandArtifact of getCommandArtifacts(projectDir, tool)) {
      cacheRoots.add(dirname(commandArtifact.path))
      for (const legacyPath of commandArtifact.legacyPaths ?? [])
        cacheRoots.add(dirname(legacyPath))
    }
  }
  for (const root of cacheRoots) clearCache(root)
}

async function readArtifactDirectory(dir: string): Promise<ReadonlySet<string>> {
  return new Set(await reactiveReadDir(dir, { includeHidden: true }))
}

async function getExistingInventorySkillPaths(
  inventoryRoot: string,
  entries: readonly ArtifactEntry[]
): Promise<Set<string>> {
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

  return getExistingInventorySkillPaths(resolve(toolRoot, 'skills'), entries)
}

async function getExistingCommandPaths(entries: readonly ArtifactEntry[]): Promise<Set<string>> {
  const pathsByDirectory = new Map<string, string[]>()
  for (const entry of entries) {
    for (const path of [entry.path, ...(entry.legacyPaths ?? [])]) {
      const paths = pathsByDirectory.get(dirname(path)) ?? []
      paths.push(path)
      pathsByDirectory.set(dirname(path), paths)
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

function resolveExistingArtifactPath(
  entry: ArtifactEntry,
  existingPaths: ReadonlySet<string>
): string | null {
  if (existingPaths.has(entry.path)) return entry.path
  return entry.legacyPaths?.find((legacyPath) => existingPaths.has(legacyPath)) ?? null
}

function collectExistingWorkflows(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): ToolWorkflowId[] {
  return entries
    .filter((entry) => hasExistingArtifact(entry, existingPaths))
    .map((entry) => entry.workflow)
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

function extractGeneratedByVersion(content: string | null): string | null {
  if (!content) return null
  return content.match(/^\s*generatedBy:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1]?.trim() ?? null
}

async function readGeneratedByVersion(
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>
): Promise<string | null> {
  for (const entry of entries) {
    if (!existingPaths.has(entry.path)) continue
    const generatedByVersion = extractGeneratedByVersion(await reactiveReadFile(entry.path))
    if (generatedByVersion) return generatedByVersion
  }
  return null
}

async function areExpectedCommandContentsCurrent(
  toolId: string,
  entries: readonly ArtifactEntry[],
  existingPaths: ReadonlySet<string>,
  commandContents: AgentCommandContentCatalog | null | undefined
): Promise<boolean> {
  if (entries.length === 0) return false
  const expectedContents = commandContents?.[toolId]
  if (!expectedContents) return false
  for (const entry of entries) {
    const path = resolveExistingArtifactPath(entry, existingPaths)
    const expectedContent = expectedContents[entry.workflow]
    if (!path || expectedContent === undefined) return false
    const actualContent = await reactiveReadFile(path)
    if (
      actualContent === null ||
      !isEquivalentAgentCommandContent(toolId, actualContent, expectedContent)
    ) {
      return false
    }
  }
  return true
}

/**
 * Series-aware generator currency.
 *
 * Artifacts whose `generatedBy` stamp names the admitted line (stable 1.12.x) are
 * current; every below-admitted generator (the retired 1.10.x/1.11.x window and
 * older) plus unparseable or future stamps is stale. The pinned constant never
 * feeds this comparison — it is fallback display only and never fabricates a
 * live version.
 */
function isCurrentGeneratedByVersion(version: string | null, hasAnyArtifacts: boolean): boolean {
  if (!hasAnyArtifacts) return true
  return parseOpenSpecCliSeries(version) !== null
}

async function collectCodexCleanup(
  cleanup: AgentManagedGlobalPromptCleanup
): Promise<ToolInitCleanupState | undefined> {
  const promptRoot = getExternalCodexCommandObservationRoot()
  const promptFiles = await readArtifactDirectory(promptRoot)
  const managedFiles = Object.entries(cleanup.managedFiles).filter(([fileName]) =>
    promptFiles.has(fileName)
  )
  if (managedFiles.length === 0) return undefined
  return {
    required: true,
    kind: cleanup.kind,
    paths: managedFiles.map(([fileName]) => join(promptRoot, fileName)),
    workflows: toKnownWorkflows(managedFiles.flatMap(([, workflows]) => workflows)),
    replacementLabel: cleanup.replacementLabel,
  }
}

function cleanupPatternMatches(fileName: string, patternName: string): boolean {
  const escaped = patternName.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replaceAll('*', '.*')
  return new RegExp(`^${escaped}$`, 'u').test(fileName)
}

function isAmbiguousProjectCleanupPattern(tool: ToolConfig, pattern: string): boolean {
  if (!pattern.includes('opsx-*') || !tool.command) return false
  const commandPatterns = [
    tool.command.pathTemplate,
    ...(tool.command.legacyPathTemplates ?? []),
  ].map((pathTemplate) => pathTemplate.replace('{workflow}', '*'))
  return commandPatterns.includes(pattern)
}

async function collectProjectCleanup(
  projectDir: string,
  tool: ToolConfig,
  cleanup: AgentProjectCleanup,
  projectRootEntries: ReadonlySet<string>,
  extraPatterns: readonly string[] = []
): Promise<{ paths: string[]; workflows: ToolWorkflowId[] }> {
  const paths: string[] = []
  const workflows: string[] = []
  for (const pattern of [...cleanup.patterns, ...extraPatterns]) {
    if (isAmbiguousProjectCleanupPattern(tool, pattern)) continue
    const rootName = pattern.split('/')[0]
    if (!rootName || !projectRootEntries.has(rootName)) continue
    const absolutePattern = resolve(projectDir, pattern)
    if (!pattern.includes('*')) {
      const parentEntries = await readArtifactDirectory(dirname(absolutePattern))
      if (parentEntries.has(basename(absolutePattern))) paths.push(absolutePattern)
      continue
    }
    const directory = dirname(absolutePattern)
    const filePattern = basename(absolutePattern)
    const entries = await readArtifactDirectory(directory)
    for (const fileName of entries) {
      if (!cleanupPatternMatches(fileName, filePattern)) continue
      paths.push(join(directory, fileName))
      const workflow = fileName
        .replace(/^opsx-/u, '')
        .replace(/^openspec-/u, '')
        .replace(/\.(?:prompt\.)?(?:md|toml|prompt)$/u, '')
      workflows.push(workflow)
    }
  }
  return { paths, workflows: toKnownWorkflows(workflows) }
}

async function collectCleanup(
  projectDir: string,
  tool: ToolConfig,
  projectRootEntries: ReadonlySet<string>
): Promise<ToolInitCleanupState | undefined> {
  if (!tool.cleanup) return undefined
  const globalCleanup =
    tool.cleanup.kind === 'managed-global-prompts'
      ? await collectCodexCleanup(tool.cleanup)
      : undefined
  const projectCleanup = await collectProjectCleanup(
    projectDir,
    tool,
    tool.cleanup.kind === 'project-patterns'
      ? tool.cleanup
      : { kind: 'project-patterns', patterns: [] },
    projectRootEntries,
    tool.cleanup.kind === 'managed-global-prompts' ? tool.cleanup.projectPatterns : []
  )
  const paths = [...projectCleanup.paths, ...(globalCleanup?.paths ?? [])]
  if (paths.length === 0) return undefined
  const workflows = [...new Set([...projectCleanup.workflows, ...(globalCleanup?.workflows ?? [])])]
  return {
    required: true,
    kind:
      projectCleanup.paths.length > 0 && globalCleanup
        ? 'mixed'
        : globalCleanup
          ? 'managed-global-prompts'
          : 'project-artifacts',
    paths,
    workflows,
    replacementLabel: globalCleanup?.replacementLabel ?? 'OpenSpec 1.12 Agent delivery',
  }
}

async function collectMigrationEvidence(
  projectDir: string,
  tool: ToolConfig,
  projectRootEntries: ReadonlySet<string>
): Promise<MigrationEvidence | undefined> {
  for (const migration of tool.migrations ?? []) {
    const skillArtifacts = getSkillArtifacts(projectDir, migration.from)
    const commandArtifacts = getCommandArtifacts(projectDir, tool, migration.from)
    const skillPaths = await getExistingSkillPaths(
      projectDir,
      migration.from,
      skillArtifacts,
      projectRootEntries
    )
    const commandPaths = await getExistingCommandPaths(commandArtifacts)
    const workflows = [
      ...new Set([
        ...collectExistingWorkflows(skillArtifacts, skillPaths),
        ...collectExistingWorkflows(commandArtifacts, commandPaths),
      ]),
    ]
    if (workflows.length === 0) continue
    return {
      state: {
        ...migration,
        workflows,
        skillFiles: collectExistingWorkflows(skillArtifacts, skillPaths).length,
        commandFiles: collectExistingWorkflows(commandArtifacts, commandPaths).length,
      },
      skillPaths,
      commandPaths,
      skillArtifacts,
      commandArtifacts,
    }
  }
  return undefined
}

function resolveSummaryStatus(
  readiness: ToolInitReadiness,
  issues: readonly ToolInitIssue[]
): ToolInitStatus {
  if (issues.includes('migration-required')) return 'migration-required'
  if (issues.includes('cleanup-needed')) return 'cleanup-needed'
  if (issues.includes('stale-version')) return 'stale-version'
  return readiness
}

async function projectToolInitStates(
  projectDir: string,
  options: ToolInitProjectionOptions
): Promise<ToolInitState[]> {
  const desiredWorkflows = toKnownWorkflows(options.workflows)
  const desiredWorkflowSet = new Set(desiredWorkflows)
  const projectRootEntries = await readArtifactDirectory(projectDir)

  const officialRegistry = options.registry ?? AI_TOOLS
  return Promise.all(
    officialRegistry.map(async (tool) => {
      const skillsScope = resolveToolSkillsScope(tool)
      if (!tool.available || skillsScope.kind === 'none') {
        return {
          toolId: tool.value,
          toolName: tool.name,
          status: 'unavailable',
          readiness: 'unavailable',
          issues: [],
          hasAnyArtifacts: false,
          commandSurfaceUnavailableReason: null,
          expectedSkillCount: 0,
          presentExpectedSkillCount: 0,
          detectedSkillCount: 0,
          expectedCommandCount: 0,
          presentExpectedCommandCount: 0,
          detectedCommandCount: 0,
          missingSkillWorkflows: [],
          missingCommandWorkflows: [],
          unexpectedSkillWorkflows: [],
          unexpectedCommandWorkflows: [],
          legacyCommandWorkflows: [],
          installedSkillWorkflows: [],
          installedCommandWorkflows: [],
          generatedByVersion: null,
          skillsScope,
          legacySkillRoots: [],
          requiresIdeRestart: tool.requiresIdeRestart === true,
        } satisfies ToolInitState
      }

      const shouldGenerateSkills =
        options.delivery !== 'commands' || tool.capability === 'skills-invocable'
      const shouldGenerateCommands =
        options.delivery !== 'skills' && tool.capability === 'adapter-backed'
      const inventoryRoot =
        skillsScope.kind === 'user-global'
          ? resolveGlobalSkillsInventoryDir(skillsScope.globalSkillsDir)
          : resolve(projectDir, skillsScope.skillsDir, 'skills')
      const skillArtifacts = getSkillArtifactsFromInventory(inventoryRoot)
      // A skills-only projection has no command surface to inspect. Avoid touching command
      // directories in that mode so the first retained snapshot is bounded by its real owner.
      const shouldInspectCommands =
        options.delivery !== 'skills' && skillsScope.kind !== 'user-global'
      const commandArtifacts = shouldInspectCommands ? getCommandArtifacts(projectDir, tool) : []
      const existingSkillPaths =
        skillsScope.kind === 'user-global'
          ? await getExistingInventorySkillPaths(inventoryRoot, skillArtifacts)
          : await getExistingSkillPaths(
              projectDir,
              (skillsScope as { kind: 'project'; skillsDir: string }).skillsDir,
              skillArtifacts,
              projectRootEntries
            )
      const existingCommandPaths = shouldInspectCommands
        ? await getExistingCommandPaths(commandArtifacts)
        : new Set<string>()

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
        skillArtifacts,
        shouldGenerateSkills ? desiredWorkflowSet : new Set<ToolWorkflowId>(),
        existingSkillPaths
      )
      const unexpectedCommandWorkflows = collectUnexpectedWorkflows(
        commandArtifacts,
        shouldGenerateCommands ? desiredWorkflowSet : new Set<ToolWorkflowId>(),
        existingCommandPaths
      )
      const installedSkillWorkflows = collectExistingWorkflows(skillArtifacts, existingSkillPaths)
      const installedCommandWorkflows = collectExistingWorkflows(
        commandArtifacts,
        existingCommandPaths
      )
      const legacyCommandWorkflows = collectLegacyWorkflows(commandArtifacts, existingCommandPaths)
      const migrationEvidence = await collectMigrationEvidence(projectDir, tool, projectRootEntries)
      const cleanup = await collectCleanup(projectDir, tool, projectRootEntries)
      const skillGeneratedByVersion =
        (await readGeneratedByVersion(skillArtifacts, existingSkillPaths)) ??
        (migrationEvidence
          ? await readGeneratedByVersion(
              migrationEvidence.skillArtifacts,
              migrationEvidence.skillPaths
            )
          : null)
      const expectedSkillCount = expectedSkillArtifacts.length
      const expectedCommandCount = expectedCommandArtifacts.length
      const detectedSkillCount = installedSkillWorkflows.length
      const detectedCommandCount = installedCommandWorkflows.length
      const hasAnyArtifacts =
        detectedSkillCount +
          detectedCommandCount +
          (migrationEvidence?.state.workflows.length ?? 0) >
        0
      const hasSkillArtifacts = detectedSkillCount + (migrationEvidence?.state.skillFiles ?? 0) > 0
      const commandContentsCurrent =
        !hasSkillArtifacts &&
        detectedCommandCount > 0 &&
        (await areExpectedCommandContentsCurrent(
          tool.value,
          expectedCommandArtifacts,
          existingCommandPaths,
          options.commandContents
        ))
      const generatedByVersion =
        skillGeneratedByVersion ??
        (commandContentsCurrent
          ? (options.generatorVersion ?? PINNED_AGENT_GENERATOR_VERSION)
          : null)
      const isInitialized =
        missingSkillWorkflows.length === 0 &&
        missingCommandWorkflows.length === 0 &&
        unexpectedSkillWorkflows.length === 0 &&
        unexpectedCommandWorkflows.length === 0
      const migration = migrationEvidence?.state
      const readiness: ToolInitReadiness = !hasAnyArtifacts
        ? 'uninitialized'
        : isInitialized
          ? 'initialized'
          : 'partial'
      const issues: ToolInitIssue[] = []
      if (!isCurrentGeneratedByVersion(generatedByVersion, hasAnyArtifacts)) {
        issues.push('stale-version')
      }
      if (cleanup) issues.push('cleanup-needed')
      if (migration) issues.push('migration-required')

      return {
        toolId: tool.value,
        toolName: tool.name,
        status: resolveSummaryStatus(readiness, issues),
        readiness,
        issues,
        hasAnyArtifacts,
        expectedSkillCount,
        presentExpectedSkillCount: expectedSkillCount - missingSkillWorkflows.length,
        detectedSkillCount,
        expectedCommandCount,
        presentExpectedCommandCount: expectedCommandCount - missingCommandWorkflows.length,
        detectedCommandCount,
        missingSkillWorkflows,
        missingCommandWorkflows,
        unexpectedSkillWorkflows,
        unexpectedCommandWorkflows,
        legacyCommandWorkflows,
        installedSkillWorkflows,
        installedCommandWorkflows,
        generatedByVersion,
        skillsScope,
        legacySkillRoots: [...(tool.legacySkillsDirs ?? [])],
        requiresIdeRestart: tool.requiresIdeRestart === true,
        commandSurfaceUnavailableReason: options.unavailableCommandTools?.[tool.value] ?? null,
        cleanup,
        migration,
      } satisfies ToolInitState
    })
  )
}

/** Read a fresh one-shot Project Agent artifact inventory. */
export async function getToolInitStates(
  projectDir: string,
  options: ToolInitProjectionOptions
): Promise<ToolInitState[]> {
  invalidateToolInitCaches(projectDir)
  return projectToolInitStates(projectDir, options)
}

/** Create a retained Agent inventory task executed by one ReactiveContext. */
export function createToolInitStateProjection(
  projectDir: string,
  options: ToolInitProjectionOptions
): () => Promise<ToolInitState[]> {
  // Retain every version-scoped fact for the projection's whole lifetime so a replacement
  // emission can never fall back to the global newest inventory: the admitted CLI line that
  // selected this registry stays authoritative across reactive re-observation.
  const projectionOptions = {
    delivery: options.delivery,
    workflows: [...options.workflows],
    generatorVersion: options.generatorVersion,
    commandContents: options.commandContents,
    unavailableCommandTools: options.unavailableCommandTools ?? null,
    registry: options.registry ? options.registry.map((tool) => ({ ...tool })) : undefined,
  } satisfies ToolInitProjectionOptions
  return () => projectToolInitStates(projectDir, projectionOptions)
}
