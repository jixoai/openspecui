/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Prove workflow target freshness uses Manager generation and root identity.
 * 2. Prove observation refreshes do not invalidate an otherwise current target.
 * 3. Prove Root A to B replacement rejects the old prepared target.
 *
 * Original request (2026-07-20): "same-generation refresh 不得误判 stale，A->B 必须拒绝旧 target。"
 */
import type { RootContext, WorkflowInvocationTargetV2 } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { isWorkflowTargetCurrent } from './opsx-workflow-invocation'

const planningRoot = {
  path: '/planning-a',
  source: 'nearest' as const,
  healthy: true,
  status: [],
} satisfies NonNullable<RootContext['planningRoot']>

const target = {
  launchProject: { path: '/launch' },
  planningRoot,
  storeId: null,
  generation: 'planning-a-generation',
  observedAt: 1,
  rootSelector: {},
  references: [],
  diagnostics: { root: [], doctor: [], context: [] },
  rootEvidence: { doctor: null, context: null },
} satisfies WorkflowInvocationTargetV2

function readyRoot(observedAt: number, root = planningRoot, generation = target.generation) {
  return {
    status: 'ready' as const,
    context: {
      planningRoot: root,
      storeId: null,
      generation,
      observedAt,
    },
  }
}

describe('isWorkflowTargetCurrent', () => {
  it('keeps a target current when only the Root Context observation changes', () => {
    expect(isWorkflowTargetCurrent(target, readyRoot(1))).toBe(true)
    expect(isWorkflowTargetCurrent(target, readyRoot(2))).toBe(true)
  })

  it('rejects a target after the Manager generation or planning-root identity changes', () => {
    const planningRootB = {
      ...planningRoot,
      path: '/planning-b',
    }

    expect(
      isWorkflowTargetCurrent(target, readyRoot(2, planningRoot, 'planning-b-generation'))
    ).toBe(false)
    expect(isWorkflowTargetCurrent(target, readyRoot(2, planningRootB, target.generation))).toBe(
      false
    )
  })
})
