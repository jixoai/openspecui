/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Prove the pinned Core profile always projects its complete effective workflow set.
 * 2. Keep custom profile omission and explicit malformed values distinct from Core defaults.
 * 3. Preserve the raw CLI payload contract outside the effective workflow projection.
 *
 * Original request (2026-07-18): "Core defaults must match the pinned OpenSpec CLI semantics."
 */
import { describe, expect, it } from 'vitest'
import { effectiveOpsxWorkflowList, parseOpsxProfileListJson } from './opsx-profile-state.js'

const CORE_WORKFLOWS = ['propose', 'explore', 'apply', 'update', 'sync', 'archive']

describe('effectiveOpsxWorkflowList', () => {
  it.each([
    { label: 'omitted', config: { profile: 'core' } },
    { label: 'empty', config: { profile: 'core', workflows: [] } },
    { label: 'partial', config: { profile: 'core', workflows: ['apply'] } },
    {
      label: 'invalid values',
      config: { profile: 'core', workflows: ['apply', 1, null, ''] },
    },
  ])('uses the complete pinned Core set when workflows are $label', ({ config }) => {
    expect(effectiveOpsxWorkflowList(config)).toEqual(CORE_WORKFLOWS)
  })

  it('keeps omitted custom workflows empty', () => {
    expect(effectiveOpsxWorkflowList({ profile: 'custom' })).toEqual([])
  })

  it('filters only valid explicit custom workflow values', () => {
    expect(
      effectiveOpsxWorkflowList({ profile: 'custom', workflows: ['apply', 1, null, '', 'update'] })
    ).toEqual(['apply', 'update'])
  })
})

describe('parseOpsxProfileListJson', () => {
  it('normalizes an omitted profile to the pinned Core profile', () => {
    expect(parseOpsxProfileListJson('{}')).toMatchObject({
      profile: 'core',
      workflows: CORE_WORKFLOWS,
    })
  })

  it('keeps the parsed effective projection separate from the raw CLI document', () => {
    const raw = { profile: 'core', workflows: ['legacy'], futureField: { enabled: true } }
    const parsed = parseOpsxProfileListJson(JSON.stringify(raw))

    expect(parsed).toMatchObject({ profile: 'core', workflows: CORE_WORKFLOWS })
    expect(raw).toEqual({ profile: 'core', workflows: ['legacy'], futureField: { enabled: true } })
  })
})
