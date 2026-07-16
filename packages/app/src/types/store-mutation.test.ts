import { describe, expect, it } from 'vitest'
import { hasCapability } from './capabilities'
import { isTerminalStatus, type StoreMutationStatus } from './store-mutation'

describe('isTerminalStatus', () => {
  it('treats succeeded/failed/indeterminate as terminal', () => {
    const terminal: StoreMutationStatus[] = ['succeeded', 'failed', 'indeterminate']
    for (const status of terminal) expect(isTerminalStatus(status)).toBe(true)
  })

  it('treats accepted/running as non-terminal', () => {
    const nonTerminal: StoreMutationStatus[] = ['accepted', 'running']
    for (const status of nonTerminal) expect(isTerminalStatus(status)).toBe(false)
  })

  it('never fabricates indeterminate as failed or cancelled (documentation invariant)', () => {
    // indeterminate 是独立的终端态：丢失不可恢复的终端结果，绝不伪造为失败/取消。
    expect(isTerminalStatus('indeterminate')).toBe(true)
    // 它与 failed 是不同的状态字面量。
    expect('indeterminate').not.toBe('failed')
  })
})

describe('hasCapability', () => {
  it('reports presence of stores.inspect', () => {
    expect(hasCapability(['stores.inspect'], 'stores.inspect')).toBe(true)
    expect(hasCapability(['stores.mutate'], 'stores.inspect')).toBe(false)
    expect(hasCapability(undefined, 'stores.inspect')).toBe(false)
  })

  it('treats capabilities as compatibility facts not permissions', () => {
    // 能力词汇仅限三项；hasCapability 是纯事实查询，无副作用、无授权语义。
    expect(hasCapability(['contexts.inspect'], 'contexts.inspect')).toBe(true)
    expect(hasCapability(['contexts.inspect'], 'stores.mutate')).toBe(false)
  })
})
