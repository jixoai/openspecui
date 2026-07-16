/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Lock mutation-to-facet mappings for project, schema, data-home, Store, and Workset commands.
 * 2. Prove read-only and unknown commands do not invent affected projections.
 *
 * Original request (2026-07-15): "操作成功底层是要推送变更的，然后让多端基于订阅拉取更新。"
 */
import { describe, expect, it } from 'vitest'
import { getOpenSpecMutationFacets } from './open-spec-mutation-facets.js'

describe('getOpenSpecMutationFacets', () => {
  it.each([
    [
      ['init', '--tools', 'claude'],
      ['project', 'context'],
    ],
    [['update'], ['project', 'context']],
    [
      ['archive', 'change-id', '--yes'],
      ['project', 'context'],
    ],
    [
      ['new', 'change', 'change-id'],
      ['project', 'context'],
    ],
    [
      ['schema', 'init', 'custom'],
      ['project', 'context', 'schemas'],
    ],
    [
      ['schema', 'fork', 'spec-driven', 'custom'],
      ['project', 'context', 'schemas'],
    ],
    [
      ['config', '--scope', 'global', 'set', 'profile', 'core'],
      ['stores', 'worksets', 'schemas', 'context'],
    ],
    [
      ['store', 'remove', 'shared', '--yes'],
      ['stores', 'context'],
    ],
    [['workset', 'remove', 'demo'], ['worksets']],
  ] as const)('maps %j to %j', (args, expected) => {
    expect(getOpenSpecMutationFacets(args)).toEqual(expected)
  })

  it.each([
    ['list', '--json'],
    ['validate', 'change-id', '--type', 'change'],
    ['schema', 'which', 'spec-driven', '--json'],
    ['config', 'get', 'set'],
    ['store', 'doctor', '--json'],
    ['workset', 'list', '--json'],
    ['archive', '--help'],
    ['future-command', '--json'],
  ])('does not infer invalidation for %j', (...args) => {
    expect(getOpenSpecMutationFacets(args)).toBeNull()
  })
})
