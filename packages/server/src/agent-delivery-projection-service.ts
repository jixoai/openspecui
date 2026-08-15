/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Combine the complete OpenSpec 1.9 Agent registry with authoritative Environment delivery policy.
 * 2. Expose fresh one-shot physical projections through Core `getToolInitStates`.
 * 3. Retain reactive physical projections through Core `createToolInitStateProjection`.
 * 4. Rebind retained work when Environment policy changes and retire all work on dispose.
 * 5. Observe user-global skill roots (MiniMax Code) beside the project root and Codex prompt root.
 *
 * Original request (2026-08-01): "新增 Agent delivery projection service 及 checked tests。"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */

import {
  ReactiveContext,
  createToolInitStateProjection,
  getExternalAgentSkillsObservationRoots,
  getExternalCodexCommandObservationRoot,
  getToolInitStates,
  loadOpenSpecAgentCommandContents,
  normalizeAgentDeliveryPolicy,
  selectAgentDeliveryRegistry,
  type AgentCommandArtifact,
  type AgentCommandContentFormat,
  type AgentCommandContentResult,
  type AgentDeliveryCleanup,
  type AgentDeliveryPolicy,
  type CliExecutor,
  type CliProjectionNotice,
  type EnvironmentGlobalProjectionData,
  type ObservationRootOwner,
  type ToolConfig,
  type ToolInitState,
  type WatcherRootRelease,
} from '@openspecui/core'
import type { EnvironmentGlobalProjectionService } from './environment-global-projection-service.js'
import type { ProjectionWorkSubscription } from './projection-work/index.js'

/** Complete registry, policy, and physical state exposed by the Server Agent owner. */
export interface AgentDeliveryProjection {
  registry: readonly ToolConfig[]
  policy: AgentDeliveryPolicy
  states: readonly ToolInitState[]
}

/** Retained projection event without transport or Router ownership. */
export type AgentDeliveryProjectionEvent =
  | { type: 'snapshot'; projection: AgentDeliveryProjection }
  | { type: 'failed'; error: Error }

/** Disposable retained Agent projection handle. */
export interface AgentDeliveryProjectionSubscription {
  unsubscribe(): void
}

/** Minimal Environment authority consumed by the Agent delivery service. */
export interface AgentDeliveryEnvironmentAuthority {
  getCurrent(): Promise<EnvironmentGlobalProjectionData>
  refresh(): unknown
  subscribe(listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription
}

export interface AgentDeliveryProjectionServiceOptions {
  projectDir: string
  environmentGlobalProjectionService: AgentDeliveryEnvironmentAuthority
  observationEnvironment: ObservationRootOwner
  cliExecutor: Pick<CliExecutor, 'checkAvailability'>
  cliCommandAuthority: { getCliCommand(): Promise<readonly string[]> }
}

/** Raised when the CLI-owned Environment projection cannot provide an executable Agent policy. */
export class AgentDeliveryPolicyUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AgentDeliveryPolicyUnavailableError'
  }
}

function cloneCommandContent(content: AgentCommandContentFormat): AgentCommandContentFormat {
  if (content.kind === 'toml') return { kind: content.kind, fields: [...content.fields] }
  return {
    kind: content.kind,
    frontmatter:
      content.frontmatter.kind === 'yaml'
        ? { kind: content.frontmatter.kind, fields: [...content.frontmatter.fields] }
        : { kind: content.frontmatter.kind },
    bodyLayout: content.bodyLayout,
  }
}

function cloneCommand(command: AgentCommandArtifact | null): AgentCommandArtifact | null {
  if (!command) return null
  return {
    ...command,
    content: cloneCommandContent(command.content),
    invocation: { ...command.invocation },
    ...(command.legacyPathTemplates
      ? { legacyPathTemplates: [...command.legacyPathTemplates] }
      : {}),
  }
}

function cloneCleanup(cleanup: AgentDeliveryCleanup | undefined): AgentDeliveryCleanup | undefined {
  if (!cleanup) return undefined
  if (cleanup.kind === 'project-patterns') {
    return { kind: cleanup.kind, patterns: [...cleanup.patterns] }
  }
  return {
    kind: cleanup.kind,
    projectPatterns: [...cleanup.projectPatterns],
    managedFiles: Object.fromEntries(
      Object.entries(cleanup.managedFiles).map(([fileName, workflows]) => [
        fileName,
        [...workflows],
      ])
    ),
    replacementLabel: cleanup.replacementLabel,
  }
}

function cloneRegistry(registry: readonly ToolConfig[]): ToolConfig[] {
  return registry.map((tool) => ({
    name: tool.name,
    value: tool.value,
    available: tool.available,
    skillsDir: tool.skillsDir,
    capability: tool.capability,
    command: cloneCommand(tool.command),
    ...(tool.successLabel !== undefined ? { successLabel: tool.successLabel } : {}),
    ...(tool.detectionPaths ? { detectionPaths: [...tool.detectionPaths] } : {}),
    ...(tool.setupNote !== undefined ? { setupNote: tool.setupNote } : {}),
    ...(tool.aliases ? { aliases: [...tool.aliases] } : {}),
    ...(tool.legacySkillsDirs ? { legacySkillsDirs: [...tool.legacySkillsDirs] } : {}),
    ...(tool.globalSkillsDir !== undefined && tool.globalSkillsDir !== null
      ? { globalSkillsDir: tool.globalSkillsDir }
      : {}),
    ...(tool.requiresIdeRestart !== undefined
      ? { requiresIdeRestart: tool.requiresIdeRestart }
      : {}),
    ...(tool.cleanup ? { cleanup: cloneCleanup(tool.cleanup) } : {}),
    ...(tool.migrations
      ? { migrations: tool.migrations.map((migration) => ({ ...migration })) }
      : {}),
  }))
}

function resolvePolicy(environment: EnvironmentGlobalProjectionData): AgentDeliveryPolicy {
  const { profileState } = environment
  if (!profileState.available) {
    throw new AgentDeliveryPolicyUnavailableError(
      profileState.error ?? 'Environment Agent delivery policy is unavailable.'
    )
  }
  if (!profileState.profile) {
    throw new AgentDeliveryPolicyUnavailableError(
      'Environment Agent delivery profile is unavailable.'
    )
  }
  if (!profileState.delivery) {
    throw new AgentDeliveryPolicyUnavailableError('Environment Agent delivery mode is unavailable.')
  }
  return {
    ...normalizeAgentDeliveryPolicy(profileState),
  }
}

function policyFingerprint(policy: AgentDeliveryPolicy): string {
  return JSON.stringify([policy.profile, policy.delivery, policy.workflows])
}

interface AgentGeneratorEvidence {
  /** Detected CLI version; null when the runner is unavailable or versionless (no inventory). */
  version: string | null
  commandContents: AgentCommandContentResult | null
}

async function resolveGeneratorEvidence(
  cliExecutor: Pick<CliExecutor, 'checkAvailability'>,
  cliCommandAuthority: { getCliCommand(): Promise<readonly string[]> },
  workflows: readonly string[]
): Promise<AgentGeneratorEvidence> {
  const availability = await cliExecutor.checkAvailability()
  // Version identity for inventory selection comes only from a live, available CLI. An
  // unavailable or versionless runner selects no inventory at all — fabricating the pinned
  // 1.9.0 here would hand a non-admitted session the full 1.9 registry. The pinned constant
  // stays in use only where Core compares on-disk generated-by evidence.
  const version = availability.available && availability.version ? availability.version : null
  const commandContents = availability.available
    ? await loadOpenSpecAgentCommandContents(await cliCommandAuthority.getCliCommand(), workflows)
    : null
  return { version, commandContents }
}

function createProjection(
  policy: AgentDeliveryPolicy,
  states: readonly ToolInitState[],
  generatorEvidence: AgentGeneratorEvidence
): AgentDeliveryProjection {
  return {
    // The official inventory belongs to the admitted running CLI line, not to one fixed
    // registry: a supported 1.8 session lists exactly its own official targets.
    registry: cloneRegistry(selectAgentDeliveryRegistry(generatorEvidence.version)),
    policy: {
      profile: policy.profile,
      delivery: policy.delivery,
      workflows: [...policy.workflows],
    },
    states: [...states],
  }
}

class RetainedAgentDeliveryProjection implements AgentDeliveryProjectionSubscription {
  private authorityGeneration = 0
  private environmentSubscription: ProjectionWorkSubscription | null = null
  private physicalController: AbortController | null = null
  private physicalGeneration = 0
  private currentPolicyFingerprint: string | null = null
  private disposed = false

  constructor(
    private readonly options: AgentDeliveryProjectionServiceOptions,
    private readonly listener: (event: AgentDeliveryProjectionEvent) => void,
    private readonly preparePhysicalObservation: () => Promise<void>,
    private readonly onDispose: () => void
  ) {
    this.environmentSubscription = options.environmentGlobalProjectionService.subscribe(() => {
      this.rebindFromEnvironment()
    })
    this.rebindFromEnvironment()
  }

  replacePolicy(policy: AgentDeliveryPolicy): void {
    if (this.disposed) return
    this.bindPolicy(policy, true)
  }

  unsubscribe(): void {
    if (this.disposed) return
    this.disposed = true
    this.authorityGeneration += 1
    this.environmentSubscription?.unsubscribe()
    this.environmentSubscription = null
    this.stopPhysicalProjection()
    this.onDispose()
  }

  private rebindFromEnvironment(): void {
    const generation = ++this.authorityGeneration
    void this.options.environmentGlobalProjectionService
      .getCurrent()
      .then((environment) => {
        if (this.disposed || generation !== this.authorityGeneration) return
        return this.preparePhysicalObservation().then(() => {
          if (this.disposed || generation !== this.authorityGeneration) return
          return resolveGeneratorEvidence(
            this.options.cliExecutor,
            this.options.cliCommandAuthority,
            environment.profileState.workflows
          ).then((generatorEvidence) => {
            if (this.disposed || generation !== this.authorityGeneration) return
            this.startPhysicalProjection(resolvePolicy(environment), generatorEvidence, false)
          })
        })
      })
      .catch((cause: unknown) => {
        if (this.disposed || generation !== this.authorityGeneration) return
        this.stopPhysicalProjection()
        this.listener({
          type: 'failed',
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      })
  }

  private bindPolicy(policy: AgentDeliveryPolicy, force: boolean): void {
    const generation = ++this.authorityGeneration
    void Promise.all([
      this.preparePhysicalObservation(),
      resolveGeneratorEvidence(
        this.options.cliExecutor,
        this.options.cliCommandAuthority,
        policy.workflows
      ),
    ])
      .then(([, generatorEvidence]) => {
        if (this.disposed || generation !== this.authorityGeneration) return
        this.startPhysicalProjection(policy, generatorEvidence, force)
      })
      .catch((cause: unknown) => {
        if (this.disposed || generation !== this.authorityGeneration) return
        this.stopPhysicalProjection()
        this.listener({
          type: 'failed',
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      })
  }

  private startPhysicalProjection(
    policy: AgentDeliveryPolicy,
    generatorEvidence: AgentGeneratorEvidence,
    force: boolean
  ): void {
    const fingerprint = `${policyFingerprint(policy)}:${generatorEvidence.version ?? 'no-cli'}`
    if (!force && this.physicalController && fingerprint === this.currentPolicyFingerprint) return

    this.stopPhysicalProjection()
    this.currentPolicyFingerprint = fingerprint
    const generation = ++this.physicalGeneration
    const controller = new AbortController()
    this.physicalController = controller
    const context = new ReactiveContext()
    const projectToolInitStates = createToolInitStateProjection(this.options.projectDir, {
      ...policy,
      generatorVersion: generatorEvidence.version ?? undefined,
      commandContents: generatorEvidence.commandContents?.catalog ?? null,
      unavailableCommandTools: generatorEvidence.commandContents?.unavailableTools ?? null,
      registry: selectAgentDeliveryRegistry(generatorEvidence.version),
    })

    void (async () => {
      try {
        for await (const states of context.stream(projectToolInitStates, controller.signal)) {
          if (
            this.disposed ||
            controller.signal.aborted ||
            generation !== this.physicalGeneration
          ) {
            return
          }
          this.listener({
            type: 'snapshot',
            projection: createProjection(policy, states, generatorEvidence),
          })
        }
      } catch (cause: unknown) {
        if (this.disposed || controller.signal.aborted || generation !== this.physicalGeneration) {
          return
        }
        this.listener({
          type: 'failed',
          error: cause instanceof Error ? cause : new Error(String(cause)),
        })
      }
    })()
  }

  private stopPhysicalProjection(): void {
    this.physicalGeneration += 1
    this.physicalController?.abort()
    this.physicalController = null
    this.currentPolicyFingerprint = null
  }
}

/** Server-owned Agent registry and physical delivery projection boundary. */
export class AgentDeliveryProjectionService {
  private readonly subscriptions = new Set<RetainedAgentDeliveryProjection>()
  private observationStartPromise: Promise<void> | null = null
  private observationReleases: WatcherRootRelease[] = []
  private disposed = false

  constructor(private readonly options: AgentDeliveryProjectionServiceOptions) {}

  /** Read one fresh projection from the current Environment policy and physical files. */
  async getCurrent(): Promise<AgentDeliveryProjection> {
    this.assertActive()
    const environment = await this.options.environmentGlobalProjectionService.getCurrent()
    this.assertActive()
    const policy = resolvePolicy(environment)
    const generatorEvidence = await resolveGeneratorEvidence(
      this.options.cliExecutor,
      this.options.cliCommandAuthority,
      policy.workflows
    )
    const states = await getToolInitStates(this.options.projectDir, {
      ...policy,
      generatorVersion: generatorEvidence.version ?? undefined,
      commandContents: generatorEvidence.commandContents?.catalog ?? null,
      unavailableCommandTools: generatorEvidence.commandContents?.unavailableTools ?? null,
      registry: selectAgentDeliveryRegistry(generatorEvidence.version),
    })
    this.assertActive()
    return createProjection(policy, states, generatorEvidence)
  }

  /** Retain Environment policy and physical Agent artifact observation until unsubscribed. */
  subscribe(
    listener: (event: AgentDeliveryProjectionEvent) => void
  ): AgentDeliveryProjectionSubscription {
    this.assertActive()
    let subscription: RetainedAgentDeliveryProjection
    subscription = new RetainedAgentDeliveryProjection(
      this.options,
      listener,
      () => this.ensurePhysicalObservation(),
      () => {
        this.subscriptions.delete(subscription)
      }
    )
    this.subscriptions.add(subscription)
    return subscription
  }

  /** Refresh Environment authority, return a fresh Pull, and replace every retained projection. */
  async refresh(): Promise<AgentDeliveryProjection> {
    this.assertActive()
    this.options.environmentGlobalProjectionService.refresh()
    const projection = await this.getCurrent()
    for (const subscription of this.subscriptions) subscription.replacePolicy(projection.policy)
    return projection
  }

  /** Retire retained Environment and physical projection work. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    for (const subscription of this.subscriptions) subscription.unsubscribe()
    this.subscriptions.clear()
    await this.observationStartPromise?.catch(() => {})
    const releases = this.observationReleases
    this.observationReleases = []
    await Promise.all(releases.map((release) => release()))
  }

  private assertActive(): void {
    if (this.disposed) throw new Error('Agent delivery projection service is disposed.')
  }

  private ensurePhysicalObservation(): Promise<void> {
    this.assertActive()
    if (this.observationStartPromise) return this.observationStartPromise

    const startPromise = (async () => {
      const releases: WatcherRootRelease[] = []
      try {
        releases.push(
          await this.options.observationEnvironment.acquireRoot(this.options.projectDir)
        )
        releases.push(
          await this.options.observationEnvironment.acquireRoot(
            getExternalCodexCommandObservationRoot()
          )
        )
        for (const globalSkillsRoot of getExternalAgentSkillsObservationRoots()) {
          releases.push(await this.options.observationEnvironment.acquireRoot(globalSkillsRoot))
        }
        if (this.disposed) {
          await Promise.all(releases.map((release) => release()))
          return
        }
        this.observationReleases = releases
      } catch (cause: unknown) {
        await Promise.all(releases.map((release) => release()))
        throw cause
      }
    })()
    this.observationStartPromise = startPromise
    return startPromise
  }
}

type EnvironmentGlobalProjectionServiceCompatibility =
  EnvironmentGlobalProjectionService extends AgentDeliveryEnvironmentAuthority ? true : false

const environmentGlobalProjectionServiceCompatibility: EnvironmentGlobalProjectionServiceCompatibility = true
void environmentGlobalProjectionServiceCompatibility
