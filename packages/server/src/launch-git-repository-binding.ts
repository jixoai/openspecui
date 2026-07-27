/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Own the Launch-scoped Code repository binding token for one backend lifetime.
 * 2. Share the same opaque provenance with Git scope resolution and Dashboard snapshots.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 * Derived requirement (2026-07-19): Checkpoint 6.11 separates Launch Code ownership from Planning.
 */
import { randomUUID } from 'node:crypto'

/** Stable Code repository provenance issued by the backend Launch owner. */
export interface LaunchGitRepositoryBinding {
  readonly bindingToken: string
}

/** Backend-lifetime owner for the opaque Launch Code repository binding token. */
export class LaunchGitRepositoryBindingOwner implements LaunchGitRepositoryBinding {
  readonly bindingToken: string

  constructor(bindingToken?: string) {
    bindingToken ??= randomUUID()
    if (bindingToken.trim().length === 0) {
      throw new Error('Launch Git repository binding token must be non-empty.')
    }
    this.bindingToken = bindingToken
  }
}
