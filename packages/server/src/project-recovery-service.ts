import {
  subscribeWatcherRuntimeStatus,
  type GitWorktreeHandoff,
  type ProjectRecoveryStatus,
  type ProjectResidencyStatus,
  type WatcherRuntimeStatus,
} from '@openspecui/core'
import { EventEmitter } from 'node:events'
import { dirname, resolve } from 'node:path'

import {
  canonicalGitPath,
  defaultRunGit,
  parseWorktreeList,
  pathExists,
  type GitRunner,
} from './git-shared.js'

export interface ProjectRecoveryHandoffProvider {
  ensureWorktreeServer(input: { targetPath: string }): Promise<GitWorktreeHandoff>
}

interface ProjectRecoveryServiceOptions {
  projectDir: string
  gitWorktreeHandoff?: ProjectRecoveryHandoffProvider
  subscribeWatcherRuntime?: (
    listener: (status: WatcherRuntimeStatus | null) => void,
    options?: { emitCurrent?: boolean }
  ) => () => void
  runGit?: GitRunner
  pathExists?: (absolutePath: string) => Promise<boolean>
  canonicalPath?: (path: string) => Promise<string>
}

function normalizeWorktreeBranchName(defaultBranch: string): string {
  const normalized = defaultBranch.trim()
  const remoteBranchMatch = /^[^/]+\/(.+)$/.exec(normalized)
  return remoteBranchMatch?.[1] ?? normalized
}

function getGitDirArgs(gitDir: string, args: string[]): string[] {
  return ['--git-dir', gitDir, ...args]
}

export class ProjectRecoveryService {
  private emitter = new EventEmitter()
  private current: ProjectRecoveryStatus = { state: 'idle' }
  private projectDir: string
  private gitWorktreeHandoff?: ProjectRecoveryHandoffProvider
  private runGit: GitRunner
  private doesPathExist: (absolutePath: string) => Promise<boolean>
  private canonicalPath: (path: string) => Promise<string>
  private cachedGitCommonDir: string | null = null
  private cachedCanonicalProjectDir: string
  private primeRepositoryMetadataPromise: Promise<void> | null = null
  private recoveryEpoch = 0
  private unsubscribeWatcherRuntime: () => void

  constructor(options: ProjectRecoveryServiceOptions) {
    this.emitter.setMaxListeners(200)
    this.projectDir = resolve(options.projectDir)
    this.gitWorktreeHandoff = options.gitWorktreeHandoff
    this.runGit = options.runGit ?? defaultRunGit
    this.doesPathExist = options.pathExists ?? pathExists
    this.canonicalPath = options.canonicalPath ?? canonicalGitPath
    this.cachedCanonicalProjectDir = this.projectDir

    const subscribe = options.subscribeWatcherRuntime ?? subscribeWatcherRuntimeStatus
    this.unsubscribeWatcherRuntime = subscribe(
      (status) => {
        this.handleWatcherRuntimeStatus(status)
      },
      { emitCurrent: true }
    )

    void this.primeRepositoryMetadata()
  }

  getCurrent(): ProjectRecoveryStatus {
    return this.current
  }

  subscribe(
    listener: (status: ProjectRecoveryStatus) => void,
    options: { emitCurrent?: boolean } = {}
  ): () => void {
    this.emitter.on('change', listener)
    if (options.emitCurrent !== false) {
      listener(this.current)
    }

    return () => {
      this.emitter.off('change', listener)
    }
  }

  dispose(): void {
    this.unsubscribeWatcherRuntime()
    this.emitter.removeAllListeners()
  }

  private setStatus(next: ProjectRecoveryStatus): void {
    if (JSON.stringify(this.current) === JSON.stringify(next)) {
      return
    }

    this.current = next
    this.emitter.emit('change', next)
  }

  private handleWatcherRuntimeStatus(status: WatcherRuntimeStatus | null): void {
    const launchRoot = status?.roots.find(
      (root) =>
        root.rootPath === this.projectDir || root.rootPath === this.cachedCanonicalProjectDir
    )
    const residency = launchRoot?.projectResidency
    if (!residency || residency.state === 'active') {
      this.recoveryEpoch += 1
      this.setStatus({ state: 'idle' })
      void this.primeRepositoryMetadata()
      return
    }

    if (this.hasHandledEviction(residency)) {
      return
    }

    const epoch = ++this.recoveryEpoch
    this.setStatus({
      state: 'evicted',
      reason: residency.reason,
      detectedAt: residency.detectedAt,
    })
    void this.resolveRecovery(residency, epoch)
  }

  private hasHandledEviction(
    residency: Extract<ProjectResidencyStatus, { state: 'evicted' }>
  ): boolean {
    switch (this.current.state) {
      case 'evicted':
      case 'resolving':
      case 'ready':
      case 'unavailable':
      case 'failed':
        return this.current.detectedAt === residency.detectedAt
      default:
        return false
    }
  }

  private async resolveRecovery(
    residency: Extract<ProjectResidencyStatus, { state: 'evicted' }>,
    epoch: number
  ): Promise<void> {
    this.setStatus({
      state: 'resolving',
      reason: residency.reason,
      detectedAt: residency.detectedAt,
    })

    if (this.cachedGitCommonDir === null) {
      await this.primeRepositoryMetadata()
    }
    if (epoch !== this.recoveryEpoch) return

    const gitCommonDir = this.cachedGitCommonDir
    if (!gitCommonDir || !(await this.doesPathExist(gitCommonDir))) {
      this.setStatus({
        state: 'unavailable',
        reason: residency.reason,
        detectedAt: residency.detectedAt,
        message:
          'Cached Git metadata is unavailable, so automatic recovery cannot resolve a fallback worktree.',
      })
      return
    }

    const targetPath = await this.resolveFallbackTargetPath(gitCommonDir)
    if (epoch !== this.recoveryEpoch) return

    if (!targetPath) {
      this.setStatus({
        state: 'unavailable',
        reason: residency.reason,
        detectedAt: residency.detectedAt,
        message:
          'No existing default-branch worktree is available for automatic recovery. Restore the worktree manually or reopen the repo from a surviving worktree.',
      })
      return
    }

    if (!this.gitWorktreeHandoff) {
      this.setStatus({
        state: 'unavailable',
        reason: residency.reason,
        detectedAt: residency.detectedAt,
        message:
          'This runtime cannot spawn or reuse sibling worktree servers for automatic recovery.',
      })
      return
    }

    try {
      const handoff = await this.gitWorktreeHandoff.ensureWorktreeServer({ targetPath })
      if (epoch !== this.recoveryEpoch) return

      this.setStatus({
        state: 'ready',
        reason: residency.reason,
        detectedAt: residency.detectedAt,
        handoff,
      })
    } catch (error) {
      if (epoch !== this.recoveryEpoch) return

      this.setStatus({
        state: 'failed',
        reason: residency.reason,
        detectedAt: residency.detectedAt,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private async primeRepositoryMetadata(): Promise<void> {
    if (this.primeRepositoryMetadataPromise) {
      return this.primeRepositoryMetadataPromise
    }

    this.primeRepositoryMetadataPromise = (async () => {
      this.cachedCanonicalProjectDir = await this.canonicalPath(this.projectDir)
      this.cachedGitCommonDir = await this.resolveGitCommonDir()
    })()

    try {
      await this.primeRepositoryMetadataPromise
    } catch {
      this.cachedGitCommonDir = null
      this.cachedCanonicalProjectDir = this.projectDir
    } finally {
      this.primeRepositoryMetadataPromise = null
    }
  }

  private async resolveGitCommonDir(): Promise<string | null> {
    const result = await this.runGit(this.projectDir, ['rev-parse', '--git-common-dir'])
    const gitCommonDirRaw = result.ok ? result.stdout.trim() : ''
    if (!gitCommonDirRaw) {
      return null
    }
    return resolve(this.projectDir, gitCommonDirRaw)
  }

  private async resolveDefaultBranchName(gitCommonDir: string): Promise<string> {
    const cwd = dirname(gitCommonDir)
    const remoteHead = await this.runGit(
      cwd,
      getGitDirArgs(gitCommonDir, [
        'symbolic-ref',
        '--quiet',
        '--short',
        'refs/remotes/origin/HEAD',
      ])
    )
    const remoteRef = remoteHead.stdout.trim()
    if (remoteHead.ok && remoteRef) {
      return normalizeWorktreeBranchName(remoteRef)
    }

    const localHead = await this.runGit(
      cwd,
      getGitDirArgs(gitCommonDir, ['rev-parse', '--abbrev-ref', 'HEAD'])
    )
    const localRef = localHead.stdout.trim()
    if (localHead.ok && localRef && localRef !== 'HEAD') {
      return normalizeWorktreeBranchName(localRef)
    }

    return 'main'
  }

  private async resolveFallbackTargetPath(gitCommonDir: string): Promise<string | null> {
    const cwd = dirname(gitCommonDir)
    const defaultBranchName = await this.resolveDefaultBranchName(gitCommonDir)
    const worktreeListResult = await this.runGit(
      cwd,
      getGitDirArgs(gitCommonDir, ['worktree', 'list', '--porcelain'])
    )
    if (!worktreeListResult.ok) {
      return null
    }

    const parsedWorktrees = parseWorktreeList(worktreeListResult.stdout)
    for (const worktree of parsedWorktrees) {
      const targetPath = resolve(worktree.path)
      const branchName = worktree.branchRef?.replace(/^refs\/heads\//, '') ?? null
      if (worktree.detached || branchName !== defaultBranchName) {
        continue
      }

      if (!(await this.doesPathExist(targetPath))) {
        continue
      }

      const targetCanonicalPath = await this.canonicalPath(targetPath)
      if (targetCanonicalPath === this.cachedCanonicalProjectDir) {
        continue
      }

      return targetPath
    }

    return null
  }
}
