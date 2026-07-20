/**
 * Orthogonal intents (created 2026-07-21 Asia/Shanghai):
 * 1. Capture the Root Context identity that owns a dirty Compose draft.
 * 2. Distinguish same-generation observations from planning-root replacement.
 * 3. Keep dispatch recovery as a typed assertion separate from visual locking.
 *
 * Original request (2026-07-21): "Root A prepare pending -> edit -> Root B must preserve the
 * draft and require explicit confirmation or regeneration before dispatch."
 */
import type { RootContext } from '@openspecui/core'

export type ComposeRootIdentity = {
  path: string
  source: NonNullable<RootContext['planningRoot']>['source']
  storeId: string | null
  planningStoreId: string | null
  generation: string | null
}

export type ComposeDraftOwnership = {
  dirty: boolean
  root: ComposeRootIdentity | null
}

export const EMPTY_COMPOSE_DRAFT_OWNERSHIP: ComposeDraftOwnership = {
  dirty: false,
  root: null,
}

/** Typed dispatch failure emitted when a dirty draft still belongs to another Root generation. */
export class ComposeDraftRecoveryError extends Error {
  readonly code = 'compose-draft-root-mismatch'

  constructor() {
    super(
      'This edited prompt was prepared for another planning root. Confirm it for the current root or regenerate it before dispatch.'
    )
    this.name = 'ComposeDraftRecoveryError'
  }
}

export function getComposeRootIdentity(
  context: Pick<RootContext, 'planningRoot' | 'storeId' | 'generation'> | null
): ComposeRootIdentity | null {
  if (!context?.planningRoot) return null
  return {
    path: context.planningRoot.path,
    source: context.planningRoot.source,
    storeId: context.storeId,
    planningStoreId: context.planningRoot.store_id ?? null,
    generation: context.generation ?? null,
  }
}

export function isSameComposeRoot(
  left: ComposeRootIdentity | null,
  right: ComposeRootIdentity | null
): boolean {
  if (!left || !right) return left === right
  return (
    left.path === right.path &&
    left.source === right.source &&
    left.storeId === right.storeId &&
    left.planningStoreId === right.planningStoreId &&
    left.generation === right.generation
  )
}

export function requiresComposeDraftRecovery(
  ownership: ComposeDraftOwnership,
  currentRoot: ComposeRootIdentity | null
): boolean {
  return ownership.dirty && ownership.root !== null && currentRoot !== null
    ? !isSameComposeRoot(ownership.root, currentRoot)
    : false
}

export function captureComposeDraftOwnership(
  ownership: ComposeDraftOwnership,
  currentRoot: ComposeRootIdentity | null
): ComposeDraftOwnership {
  if (ownership.dirty) return ownership
  return { dirty: true, root: currentRoot }
}

/** Assert that an edited Compose draft is explicitly associated with the current root. */
export function assertComposeDraftDispatchable(
  ownership: ComposeDraftOwnership,
  currentRoot: ComposeRootIdentity | null
): void {
  if (!requiresComposeDraftRecovery(ownership, currentRoot)) return
  throw new ComposeDraftRecoveryError()
}
