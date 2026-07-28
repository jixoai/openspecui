/**
 * Orthogonal intents (created 2026-07-26 Asia/Shanghai):
 * 1. Own Environment Global CLI truth at the Server runtime-environment boundary.
 * 2. Track the CLI-resolved config path as a dynamic reactive dependency.
 * 3. Expose immediate Pull, lifecycle-only Push, explicit refresh, and settled compatibility reads.
 * 4. Keep runtime-environment Work independent from Planning-root replacement.
 * 5. Own and retire the observed physical config-path lease for the active CLI result.
 * 6. Keep editable file bytes in a separate file-native Projection Work owner.
 *
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 */
import {
  EnvironmentGlobalFileProjectionDataSchema,
  EnvironmentGlobalProjectionDataSchema,
  type CliExecutor,
  type CliProjectionNotice,
  type CliProjectionState,
  type EnvironmentGlobalConfig,
  type EnvironmentGlobalFileProjectionData,
  type EnvironmentGlobalProjectionData,
  type ObservationRootOwner,
  type OpenSpecDataScope,
  type WatcherRootRelease,
} from '@openspecui/core'
import { Buffer } from 'node:buffer'
import { dirname, resolve } from 'node:path'
import {
  readEnvironmentGlobalConfig,
  readEnvironmentGlobalFileConfig,
} from './planning-config-service.js'
import {
  projectionWorkIdentityKey,
  type ProjectionWorkIdentity,
  type ProjectionWorkRegistry,
  type ProjectionWorkRequest,
  type ProjectionWorkRuntime,
  type ProjectionWorkSubscription,
} from './projection-work/index.js'

/** Server-local registry for the effective OpenSpec runtime environment. */
export interface EnvironmentGlobalProjectionWorkOwner {
  registry: ProjectionWorkRegistry<EnvironmentGlobalProjectionData>
  fileRegistry: ProjectionWorkRegistry<EnvironmentGlobalFileProjectionData>
}

export function createEnvironmentGlobalProjectionWorkOwner(
  runtime: ProjectionWorkRuntime
): EnvironmentGlobalProjectionWorkOwner {
  return {
    registry: runtime.createRegistry<EnvironmentGlobalProjectionData>(),
    fileRegistry: runtime.createRegistry<EnvironmentGlobalFileProjectionData>(),
  }
}

export interface EnvironmentGlobalProjectionServiceOptions {
  dataScope: OpenSpecDataScope
  cliExecutor: CliExecutor
  observationEnvironment: ObservationRootOwner
  workOwner: EnvironmentGlobalProjectionWorkOwner
}

function estimateSnapshotBytes(data: EnvironmentGlobalProjectionData): number {
  return Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8')
}

/** CLI-backed Pull/Push owner for environment-global config, profile, and drift evidence. */
export class EnvironmentGlobalProjectionService {
  private configPathObservation: { directory: string; release: WatcherRootRelease } | null = null
  private configPathGeneration = 0
  private disposed = false
  private fileBridgeSubscription: ProjectionWorkSubscription | null = null

  constructor(private readonly options: EnvironmentGlobalProjectionServiceOptions) {}

  /** Retire the dynamic config-path lease before the Server observation environment closes. */
  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    const observation = this.configPathObservation
    this.configPathObservation = null
    this.fileBridgeSubscription?.unsubscribe()
    this.fileBridgeSubscription = null
    await observation?.release()
  }

  read(): CliProjectionState<EnvironmentGlobalProjectionData> {
    return this.options.workOwner.registry.read(this.identity()) ?? this.loadingState()
  }

  refresh(): CliProjectionState<EnvironmentGlobalProjectionData> {
    this.options.workOwner.registry.invalidate(this.identity())
    this.ensureFileBridge()
    return this.read()
  }

  subscribe(listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription {
    return this.options.workOwner.registry.subscribeLifecycle(this.request(), listener)
  }

  getCurrent(): Promise<EnvironmentGlobalProjectionData> {
    return new Promise((resolve, reject) => {
      let settled = false
      let subscription: ProjectionWorkSubscription | null = null
      const settle = (callback: () => void) => {
        if (settled) return
        settled = true
        try {
          callback()
        } finally {
          subscription?.unsubscribe()
        }
      }
      subscription = this.options.workOwner.registry.subscribe(this.request(), (event) => {
        if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
          settle(() => resolve(EnvironmentGlobalProjectionDataSchema.parse(event.snapshot.data)))
          return
        }
        if (event.type === 'failed') settle(() => reject(event.error))
      })
      if (settled) subscription.unsubscribe()
    })
  }

  /** Settled compatibility read combining CLI facts with the separate file-native owner. */
  async getCurrentConfig(): Promise<EnvironmentGlobalConfig> {
    const [cli, file] = await Promise.all([this.getCurrent(), this.getCurrentFile()])
    return { ...cli, kind: 'environment-global', file: file.file }
  }

  /** Immediate Pull for the file-native editable Environment Global document. */
  readFile(): CliProjectionState<EnvironmentGlobalFileProjectionData> {
    this.ensureFileBridge()
    return this.options.workOwner.fileRegistry.read(this.fileIdentity()) ?? this.fileLoadingState()
  }

  /** Explicitly invalidate the file-native owner without changing CLI facts. */
  refreshFile(): CliProjectionState<EnvironmentGlobalFileProjectionData> {
    this.ensureFileBridge()
    this.options.workOwner.fileRegistry.invalidate(this.fileIdentity())
    return this.readFile()
  }

  /** Lifecycle-only Push for file-native config content. */
  subscribeFile(listener: (notice: CliProjectionNotice) => void): ProjectionWorkSubscription {
    this.ensureFileBridge()
    return this.options.workOwner.fileRegistry.subscribeLifecycle(this.fileRequest(), listener)
  }

  /** Settled read for the file-native config content owner. */
  getCurrentFile(): Promise<EnvironmentGlobalFileProjectionData> {
    this.ensureFileBridge()
    return new Promise((resolve, reject) => {
      let settled = false
      let subscription: ProjectionWorkSubscription | null = null
      const settle = (callback: () => void) => {
        if (settled) return
        settled = true
        try {
          callback()
        } finally {
          subscription?.unsubscribe()
        }
      }
      subscription = this.options.workOwner.fileRegistry.subscribe(this.fileRequest(), (event) => {
        if (event.type === 'snapshot' && event.snapshot.freshness === 'current') {
          settle(() =>
            resolve(EnvironmentGlobalFileProjectionDataSchema.parse(event.snapshot.data))
          )
          return
        }
        if (event.type === 'failed') settle(() => reject(event.error))
      })
      if (settled) subscription.unsubscribe()
    })
  }

  private identity(): ProjectionWorkIdentity {
    return {
      projectionKind: 'environment-global',
      planningRoot: {
        identity: this.options.dataScope.path,
        source: this.options.dataScope.source,
        storeSelector: null,
      },
      owner: { generation: null, gitBindingToken: null },
      selector: 'config+profile+drift',
      inputFingerprint: 'openspec-cli-1.6:config-path+list-json+list',
      protocolVersion: 1,
    }
  }

  private request(): ProjectionWorkRequest<EnvironmentGlobalProjectionData, never> {
    return {
      identity: this.identity(),
      resourceClass: 'cli',
      priority: 'foreground',
      estimateSnapshotBytes,
      load: async ({ reportStage, signal, workGeneration }) => {
        reportStage('root-ready')
        const projection = await readEnvironmentGlobalConfig({
          dataScope: this.options.dataScope,
          cliExecutor: this.options.cliExecutor,
          observeConfigPath: (path) => this.reconcileConfigPath(path, workGeneration, signal),
        })
        reportStage('leaf-settled')
        return EnvironmentGlobalProjectionDataSchema.parse(projection)
      },
    }
  }

  private fileIdentity(): ProjectionWorkIdentity {
    return {
      projectionKind: 'environment-global-file',
      planningRoot: {
        identity: this.options.dataScope.path,
        source: this.options.dataScope.source,
        storeSelector: null,
      },
      owner: { generation: null, gitBindingToken: null },
      selector: 'config-file',
      inputFingerprint: 'openspec-cli-1.6:config-path+file-bytes',
      protocolVersion: 1,
    }
  }

  private fileRequest(): ProjectionWorkRequest<EnvironmentGlobalFileProjectionData, never> {
    return {
      identity: this.fileIdentity(),
      resourceClass: 'filesystem',
      priority: 'foreground',
      estimateSnapshotBytes: (data) => Buffer.byteLength(JSON.stringify(data) ?? '', 'utf8'),
      load: async ({ reportStage }) => {
        reportStage('root-ready')
        const cli = await this.getCurrent()
        const projection = await readEnvironmentGlobalFileConfig({
          dataScope: this.options.dataScope,
          configPath: cli.configPath,
        })
        reportStage('leaf-settled')
        return EnvironmentGlobalFileProjectionDataSchema.parse(projection)
      },
    }
  }

  private fileLoadingState(): CliProjectionState<EnvironmentGlobalFileProjectionData> {
    return {
      identity: projectionWorkIdentityKey(this.fileIdentity()),
      workGeneration: 0,
      invalidationCause: 'initial',
      state: 'loading',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    }
  }

  private ensureFileBridge(): void {
    if (this.fileBridgeSubscription || this.disposed) return
    this.fileBridgeSubscription = this.options.workOwner.registry.subscribeLifecycle(
      this.request(),
      () => {
        const cliState = this.options.workOwner.registry.read(this.identity())
        const nextPath = cliState?.data?.configPath
        const fileState = this.options.workOwner.fileRegistry.read(this.fileIdentity())
        const currentPath = fileState?.data?.file.path
        if (!cliState?.data || !fileState?.data || nextPath === currentPath) return
        this.options.workOwner.fileRegistry.invalidate(this.fileIdentity(), 'dependency')
      }
    )
  }

  private loadingState(): CliProjectionState<EnvironmentGlobalProjectionData> {
    return {
      identity: projectionWorkIdentityKey(this.identity()),
      workGeneration: 0,
      invalidationCause: 'initial',
      state: 'loading',
      data: null,
      freshness: null,
      snapshotGeneration: null,
      error: null,
    }
  }

  private async reconcileConfigPath(
    configPath: string | null,
    workGeneration: number,
    signal: AbortSignal
  ): Promise<void> {
    if (this.disposed || signal.aborted || workGeneration < this.configPathGeneration) return
    if (!configPath) {
      const previous = this.configPathObservation
      this.configPathObservation = null
      this.configPathGeneration = workGeneration
      await previous?.release()
      return
    }

    const directory = resolve(dirname(configPath))
    const previous = this.configPathObservation
    if (previous?.directory === directory) {
      this.configPathGeneration = workGeneration
      return
    }

    const release = await this.options.observationEnvironment.acquireRoot(directory)
    if (this.disposed || signal.aborted || workGeneration < this.configPathGeneration) {
      await release()
      return
    }

    this.configPathObservation = { directory, release }
    this.configPathGeneration = workGeneration
    await previous?.release()
  }
}
