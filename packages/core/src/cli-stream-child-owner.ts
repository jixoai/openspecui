/**
 * Orthogonal intents (created 2026-07-17 Asia/Shanghai):
 * 1. Own one streaming CLI child reference until its Core close/error transition releases it.
 * 2. Provide a non-root test inspection seam for lifecycle regression evidence.
 *
 * Original request (2026-07-17): "Cover repeated cancel/dispose and a late close after forced-timeout rejection."
 */
import type { ChildProcess } from 'node:child_process'

/** Snapshot of the Core-owned child slot for one observed process. */
export interface CliStreamChildOwnershipSnapshot {
  readonly currentChild: ChildProcess | null
  readonly releaseCount: number
}

/** Internal owner for the direct child of one CLI stream. */
export class CliStreamChildOwner {
  #currentChild: ChildProcess | null = null
  #releaseCount = 0

  claim(child: ChildProcess): void {
    if (this.#currentChild !== null) {
      throw new Error('Cannot claim a second child before releasing the current CLI stream child')
    }
    this.#currentChild = child
    ownersByChild.set(child, this)
  }

  owns(child: ChildProcess): boolean {
    return this.#currentChild === child
  }

  release(child: ChildProcess): boolean {
    if (!this.owns(child)) return false
    this.#currentChild = null
    this.#releaseCount += 1
    return true
  }

  get currentChild(): ChildProcess | null {
    return this.#currentChild
  }

  inspect(): CliStreamChildOwnershipSnapshot {
    return {
      currentChild: this.#currentChild,
      releaseCount: this.#releaseCount,
    }
  }
}

const ownersByChild = new WeakMap<ChildProcess, CliStreamChildOwner>()

/**
 * @internal
 * Inspects actual Core child ownership for the narrow stream-lifecycle regression test.
 * This module is intentionally not exposed from the package root or a published subpath.
 */
export function inspectCliStreamChildOwnership(
  child: ChildProcess
): CliStreamChildOwnershipSnapshot | undefined {
  return ownersByChild.get(child)?.inspect()
}
