/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Own the backend-instance Code repository binding and its stable opaque token.
 * 2. Join Planning repository bindings to the current Manager-owned root record.
 * 3. Reject stale Git intent inside the correct owner lease before repository work begins.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git repository bindings.
 */
import type {
  GitRepositoryScope,
  GitRepositoryScopeDescriptor,
  GitRepositoryScopes,
} from '@openspecui/core'
import { randomUUID } from 'node:crypto'
import {
  resolveGitRepositoryDescriptor,
  resolveGitRepositoryScopes,
  selectGitRepositoryScope,
} from './git-repository-scope.js'
import type { PlanningRootServiceResolver } from './planning-root-service.js'

/** Public input proving which backend-issued Git binding the caller observed. */
export interface ExpectedGitRepositoryBinding {
  scope: GitRepositoryScope
  expectedBindingToken: string
}

/** Typed stale-intent failure returned before a rebound repository can be observed or mutated. */
export class GitRepositoryBindingConflictError extends Error {
  readonly code = 'GIT_REPOSITORY_BINDING_STALE'

  constructor(
    readonly scope: GitRepositoryScope,
    readonly expectedBindingToken: string,
    readonly currentBindingToken: string
  ) {
    super(`The ${scope} repository binding changed. Refresh the repository scope and try again.`)
    this.name = 'GitRepositoryBindingConflictError'
  }
}

/** Server-owned Code/Planning repository binding boundary. */
export interface GitRepositoryBindingResolver {
  /** Resolve the stable Launch-owned Code binding without waiting for Planning. */
  resolveCodeScope(): Promise<GitRepositoryScopes['code']>
  /** Resolve current Code and optional distinct Planning bindings. */
  resolveScopes(options?: { reactive?: boolean }): Promise<GitRepositoryScopes>
  /** Run work only after the caller's expected binding matches the current owner. */
  run<T>(
    binding: ExpectedGitRepositoryBinding,
    operation: (repository: GitRepositoryScopeDescriptor) => Promise<T> | T
  ): Promise<T>
}

/** Runtime owners required to bind Launch Code and replaceable Planning repositories. */
export interface GitRepositoryBindingServiceOptions {
  /** Launch project directory that owns the stable Code repository binding. */
  launchProjectDir: string
  /** Manager that leases and rotates the active CLI-resolved Planning root. */
  planningRootServices: PlanningRootServiceResolver
}

/** Deep owner for repository binding epochs and stale-intent rejection. */
export class GitRepositoryBindingService implements GitRepositoryBindingResolver {
  private readonly codeBindingToken = randomUUID()

  constructor(private readonly options: GitRepositoryBindingServiceOptions) {}

  private assertCurrent(binding: ExpectedGitRepositoryBinding, currentBindingToken: string): void {
    if (binding.expectedBindingToken === currentBindingToken) return
    throw new GitRepositoryBindingConflictError(
      binding.scope,
      binding.expectedBindingToken,
      currentBindingToken
    )
  }

  private async resolveCode(): Promise<GitRepositoryScopes['code']> {
    const descriptor = await resolveGitRepositoryDescriptor({
      scope: 'code',
      bindingToken: this.codeBindingToken,
      rootPath: this.options.launchProjectDir,
    })
    return { ...descriptor, scope: 'code' }
  }

  /** Resolve the stable Launch-owned Code binding without entering the Planning lease. */
  resolveCodeScope(): Promise<GitRepositoryScopes['code']> {
    return this.resolveCode()
  }

  /** Resolve the current scope inventory through buffered or caller-reactive root ownership. */
  async resolveScopes(options: { reactive?: boolean } = {}): Promise<GitRepositoryScopes> {
    const runPlanning = options.reactive
      ? this.options.planningRootServices.runReactiveOperation.bind(
          this.options.planningRootServices
        )
      : this.options.planningRootServices.runOperation.bind(this.options.planningRootServices)

    try {
      return await runPlanning(({ rootContext, gitBindingToken }) =>
        resolveGitRepositoryScopes({
          launchProjectDir: this.options.launchProjectDir,
          codeBindingToken: this.codeBindingToken,
          planningRootDir: rootContext.planningRoot?.path ?? null,
          planningBindingToken: gitBindingToken,
        })
      )
    } catch {
      return {
        defaultScope: 'code',
        code: await this.resolveCodeScope(),
        planning: null,
      }
    }
  }

  /** Compare expected provenance and run work inside the matching repository owner. */
  async run<T>(
    binding: ExpectedGitRepositoryBinding,
    operation: (repository: GitRepositoryScopeDescriptor) => Promise<T> | T
  ): Promise<T> {
    if (binding.scope === 'code') {
      this.assertCurrent(binding, this.codeBindingToken)
      return operation(await this.resolveCode())
    }

    return this.options.planningRootServices.runOperation(
      async ({ rootContext, gitBindingToken }) => {
        // This comparison is deliberately the first action inside the active Planning lease.
        this.assertCurrent(binding, gitBindingToken)
        const planningRootDir = rootContext.planningRoot?.path
        if (!planningRootDir) {
          throw new Error('Planning repository scope requires a resolved planning root.')
        }
        const scopes = await resolveGitRepositoryScopes({
          launchProjectDir: this.options.launchProjectDir,
          codeBindingToken: this.codeBindingToken,
          planningRootDir,
          planningBindingToken: gitBindingToken,
        })
        return operation(selectGitRepositoryScope(scopes, 'planning'))
      }
    )
  }
}
