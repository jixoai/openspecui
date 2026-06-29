import { describe, expect, it } from 'vitest'
import {
  StoreListResultSchema,
  classifyStoreCliOutput,
  toStoreFeatureResult,
} from './store-types.js'

describe('classifyStoreCliOutput (beta fault-tolerance classification)', () => {
  const parse = (stdout: string) => StoreListResultSchema.parse(JSON.parse(stdout))

  it('classifies a successful, parseable output as ok', () => {
    const result = classifyStoreCliOutput({
      success: true,
      stdout: JSON.stringify({ stores: [{ id: 'team', root: '/x' }] }),
      stderr: '',
      parse,
    })
    expect(result.kind).toBe('ok')
  })

  it('tolerates additive CLI fields (lenient passthrough) and stays ok', () => {
    const result = classifyStoreCliOutput({
      success: true,
      stdout: JSON.stringify({
        stores: [{ id: 'team', root: '/x', extra: 'future-field' }],
        unknownTopLevel: true,
      }),
      stderr: '',
      parse,
    })
    expect(result.kind).toBe('ok')
  })

  it('classifies exit-0-but-unparseable output as data-incompatible (异常一) with version source', () => {
    const result = classifyStoreCliOutput({
      success: true,
      stdout: '{ not valid json',
      stderr: '',
      parse,
      cliVersion: '1.5.0',
    })
    expect(result.kind).toBe('data-incompatible')
    if (result.kind === 'data-incompatible') {
      expect(result.cliVersion).toBe('1.5.0')
      expect(result.message).toMatch(/incompatible stores payload/)
    }
  })

  it('classifies non-zero exit as command-unavailable (异常二) with version source', () => {
    const result = classifyStoreCliOutput({
      success: false,
      stdout: '',
      stderr: 'error: unknown command',
      parse,
      cliVersion: '1.4.0',
    })
    expect(result.kind).toBe('command-unavailable')
    if (result.kind === 'command-unavailable') {
      expect(result.cliVersion).toBe('1.4.0')
      expect(result.message).toMatch(/unknown command/)
    }
  })
})

describe('toStoreFeatureResult', () => {
  const parse = (stdout: string) => StoreListResultSchema.parse(JSON.parse(stdout))

  it('returns available=true with parsed stores for ok classification', () => {
    const cls = classifyStoreCliOutput({
      success: true,
      stdout: JSON.stringify({ stores: [{ id: 'a', root: '/a' }] }),
      stderr: '',
      parse,
    })
    const result = toStoreFeatureResult(cls, {
      fromData: (data) => (data as { stores: { id: string }[] }).stores,
      fallback: [],
      cliVersion: '1.5.0',
    })
    expect(result.available).toBe(true)
    expect(result.stores).toHaveLength(1)
    expect(result.cliVersion).toBe('1.5.0')
    expect(result.error).toBeUndefined()
  })

  it('returns available=false with fallback and error for data-incompatible', () => {
    const cls = classifyStoreCliOutput({
      success: true,
      stdout: 'broken',
      stderr: '',
      parse,
      cliVersion: '1.5.0',
    })
    const result = toStoreFeatureResult(cls, { fromData: () => [], fallback: [] })
    expect(result.available).toBe(false)
    expect(result.stores).toEqual([])
    expect(result.error?.kind).toBe('data-incompatible')
  })

  it('returns available=false with fallback and error for command-unavailable', () => {
    const cls = classifyStoreCliOutput({
      success: false,
      stdout: '',
      stderr: 'no such command',
      parse,
    })
    const result = toStoreFeatureResult(cls, { fromData: () => [], fallback: [] })
    expect(result.available).toBe(false)
    expect(result.stores).toEqual([])
    expect(result.error?.kind).toBe('command-unavailable')
  })
})
