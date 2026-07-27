/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Derive Store Doctor invalidation dependencies from the pinned OpenSpec 1.6 source.
 * 2. Observe non-Git Store structure/metadata precisely and Git worktree/metadata facts completely.
 * 3. Reconcile linked-worktree gitdir/commondir observation when `.git` topology changes.
 * 4. Keep filesystem evidence data-free; the typed OpenSpec CLI remains Store business truth.
 *
 * Original request (2026-07-26): "真正基于文件、甚至是文件内容结构的变更去拉取更新。"
 */
import { ProjectWatcher, type WatchEvent } from '@openspecui/core'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

type PathKind = 'missing' | 'directory' | 'file' | 'other'

interface GitTopology {
  gitDir: string | null
  commonDir: string | null
  repository: boolean
}

interface DoctorDependencyTopology {
  fingerprint: string
  git: GitTopology
}

export interface StoreDoctorDependencyObservation {
  dispose(): Promise<void>
}

export interface StoreDoctorDependencyObservationInput {
  rootPath: string
  onChange(): void
  onError?(error: unknown): void
}

export type StoreDoctorDependencyObservationFactory = (
  input: StoreDoctorDependencyObservationInput
) => Promise<StoreDoctorDependencyObservation>

const STATIC_FACT_PATHS = [
  '',
  'openspec',
  'openspec/config.yaml',
  'openspec/config.yml',
  'openspec/specs',
  'openspec/changes',
  'openspec/changes/archive',
  '.openspec-store',
  '.openspec-store/store.yaml',
  '.git',
] as const

function containsPath(rootPath: string, candidatePath: string): boolean {
  const childPath = relative(rootPath, candidatePath)
  return (
    childPath === '' ||
    (!isAbsolute(childPath) && childPath !== '..' && !childPath.startsWith(`..${sep}`))
  )
}

function nearestExistingDirectory(path: string): string {
  let candidate = path
  while (true) {
    try {
      if (statSync(candidate).isDirectory()) return candidate
    } catch {
      // Walk to the nearest physical directory that can observe the missing logical path.
    }
    const parent = dirname(candidate)
    if (parent === candidate) return candidate
    candidate = parent
  }
}

function resolvePhysicalPath(path: string): string {
  const absolutePath = resolve(path)
  const existingDirectory = nearestExistingDirectory(absolutePath)
  return resolve(realpathSync.native(existingDirectory), relative(existingDirectory, absolutePath))
}

async function pathKind(path: string): Promise<PathKind> {
  try {
    const value = await stat(path)
    if (value.isDirectory()) return 'directory'
    if (value.isFile()) return 'file'
    return 'other'
  } catch {
    return 'missing'
  }
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

async function inspectGitTopology(rootPath: string, dotGitKind: PathKind): Promise<GitTopology> {
  const dotGitPath = join(rootPath, '.git')
  if (dotGitKind === 'directory') {
    return { repository: true, gitDir: dotGitPath, commonDir: dotGitPath }
  }
  if (dotGitKind !== 'file') {
    return { repository: false, gitDir: null, commonDir: null }
  }

  const dotGitContent = await readOptional(dotGitPath)
  const gitDirMatch = dotGitContent ? /^gitdir:\s*(.+)$/im.exec(dotGitContent) : null
  if (!gitDirMatch?.[1]) {
    return { repository: true, gitDir: null, commonDir: null }
  }

  const gitDir = resolvePhysicalPath(resolve(rootPath, gitDirMatch[1].trim()))
  const commonDirContent = await readOptional(join(gitDir, 'commondir'))
  const commonDir = commonDirContent?.trim()
    ? resolvePhysicalPath(resolve(gitDir, commonDirContent.trim()))
    : gitDir
  return { repository: true, gitDir, commonDir }
}

async function inspectTopology(rootPath: string): Promise<DoctorDependencyTopology> {
  const kinds = await Promise.all(
    STATIC_FACT_PATHS.map(async (relativePath) => [
      relativePath,
      await pathKind(join(rootPath, relativePath)),
    ])
  )
  const kindRecord = Object.fromEntries(kinds) as Record<
    (typeof STATIC_FACT_PATHS)[number],
    PathKind
  >
  const metadata = await readOptional(join(rootPath, '.openspec-store', 'store.yaml'))
  const git = await inspectGitTopology(rootPath, kindRecord['.git'])
  return {
    fingerprint: JSON.stringify({ kinds: kindRecord, metadata, git }),
    git,
  }
}

function isGitMetadataFact(path: string, topology: GitTopology): boolean {
  const roots = [topology.gitDir, topology.commonDir].filter(
    (candidate): candidate is string => candidate !== null
  )
  return roots.some((rootPath) => {
    if (!containsPath(rootPath, path)) return false
    const childPath = relative(rootPath, path)
    return (
      childPath === '' ||
      childPath === 'HEAD' ||
      childPath === 'index' ||
      childPath === 'config' ||
      childPath === 'config.worktree' ||
      childPath === 'packed-refs' ||
      childPath === join('info', 'exclude') ||
      childPath === 'refs' ||
      childPath.startsWith(`refs${sep}`)
    )
  })
}

function isWorkingTreeFact(rootPath: string, path: string): boolean {
  return containsPath(rootPath, path) && !containsPath(join(rootPath, '.git'), path)
}

function externalGitRoots(rootPath: string, topology: GitTopology): string[] {
  const roots = [
    ...new Set(
      [topology.gitDir, topology.commonDir].filter(
        (candidate): candidate is string => candidate !== null && !containsPath(rootPath, candidate)
      )
    ),
  ].sort((left, right) => left.length - right.length)
  return roots.filter((candidate, index) =>
    roots.every((other, otherIndex) => otherIndex >= index || !containsPath(other, candidate))
  )
}

class StoreDoctorDependencyObserver implements StoreDoctorDependencyObservation {
  private readonly rootWatcher: ProjectWatcher
  private readonly releaseRoot: () => void
  private externalWatchers: Array<{ watcher: ProjectWatcher; release: () => void }> = []
  private topology: DoctorDependencyTopology
  private pending = Promise.resolve()
  private disposed = false

  private constructor(
    private readonly input: StoreDoctorDependencyObservationInput,
    rootWatcher: ProjectWatcher,
    releaseRoot: () => void,
    topology: DoctorDependencyTopology
  ) {
    this.rootWatcher = rootWatcher
    this.releaseRoot = releaseRoot
    this.topology = topology
  }

  static async create(
    input: StoreDoctorDependencyObservationInput
  ): Promise<StoreDoctorDependencyObserver> {
    const rootPath = resolvePhysicalPath(input.rootPath)
    const topology = await inspectTopology(rootPath)
    const rootWatcher = new ProjectWatcher(nearestExistingDirectory(rootPath), { ignore: [] })
    await rootWatcher.init()
    let observer: StoreDoctorDependencyObserver | null = null
    const releaseRoot = rootWatcher.subscribeSync(
      rootPath,
      (events) => observer?.enqueueRootEvents(events),
      { watchChildren: true }
    )
    observer = new StoreDoctorDependencyObserver(
      { ...input, rootPath },
      rootWatcher,
      releaseRoot,
      topology
    )
    await observer.rebindExternalGitRoots()
    return observer
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.releaseRoot()
    await this.pending
    await this.releaseExternalWatchers()
    await this.rootWatcher.close()
  }

  private enqueueRootEvents(events: WatchEvent[]): void {
    this.enqueue(() => this.processRootEvents(events))
  }

  private enqueueExternalEvents(events: WatchEvent[]): void {
    this.enqueue(async () => {
      if (events.some((event) => isGitMetadataFact(event.path, this.topology.git))) {
        this.input.onChange()
      }
    })
  }

  private enqueue(work: () => Promise<void>): void {
    if (this.disposed) return
    this.pending = this.pending.then(work).catch((error: unknown) => {
      this.input.onError?.(error)
    })
  }

  private async processRootEvents(events: WatchEvent[]): Promise<void> {
    if (this.disposed) return
    const previous = this.topology
    const next = await inspectTopology(this.input.rootPath)
    const topologyChanged = previous.fingerprint !== next.fingerprint
    const gitTruthMayChange =
      previous.git.repository &&
      events.some(
        (event) =>
          isWorkingTreeFact(this.input.rootPath, event.path) ||
          isGitMetadataFact(event.path, previous.git)
      )
    this.topology = next

    if (previous.git.gitDir !== next.git.gitDir || previous.git.commonDir !== next.git.commonDir) {
      await this.rebindExternalGitRoots()
    }
    if (topologyChanged || gitTruthMayChange) this.input.onChange()
  }

  private async rebindExternalGitRoots(): Promise<void> {
    await this.releaseExternalWatchers()
    for (const rootPath of externalGitRoots(this.input.rootPath, this.topology.git)) {
      if (!existsSync(nearestExistingDirectory(rootPath))) continue
      const watcher = new ProjectWatcher(nearestExistingDirectory(rootPath), { ignore: [] })
      await watcher.init()
      const release = watcher.subscribeSync(
        rootPath,
        (events) => this.enqueueExternalEvents(events),
        { watchChildren: true }
      )
      this.externalWatchers.push({ watcher, release })
    }
  }

  private async releaseExternalWatchers(): Promise<void> {
    const current = this.externalWatchers
    this.externalWatchers = []
    await Promise.all(
      current.map(async ({ watcher, release }) => {
        release()
        await watcher.close()
      })
    )
  }
}

/** Observe only the physical facts consumed by OpenSpec 1.6 `store doctor`. */
export const createStoreDoctorDependencyObservation: StoreDoctorDependencyObservationFactory = (
  input
) => StoreDoctorDependencyObserver.create(input)
