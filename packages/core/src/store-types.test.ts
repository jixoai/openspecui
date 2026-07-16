import { describe, expect, it } from 'vitest'
import {
  StoreDoctorResultSchema,
  StoreListResultSchema,
  classifyStoreCliResult,
  toStoreFeatureResult,
  type StoreCommandEvidence,
} from './store-types.js'

function evidence(options: {
  success?: boolean
  payload?: StoreCommandEvidence['payload']
  stdout?: string
  stderr?: string
}): StoreCommandEvidence {
  return {
    success: options.success ?? true,
    stdout: options.stdout ?? JSON.stringify(options.payload ?? null),
    stderr: options.stderr ?? '',
    exitCode: options.success === false ? 1 : 0,
    data: null,
    payload: options.payload ?? null,
    diagnostics: [],
  }
}

describe('Store beta projection schemas', () => {
  it('accepts additive list output with omitted diagnostics', () => {
    expect(
      StoreListResultSchema.parse({
        stores: [{ id: 'team', root: '/stores/team', future: true }],
        future: 'field',
      })
    ).toMatchObject({ stores: [{ id: 'team', root: '/stores/team', future: true }] })
  })

  it('accepts an empty healthy Store and partial doctor facts', () => {
    expect(
      StoreDoctorResultSchema.parse({
        stores: [
          {
            id: 'empty',
            root: '/stores/empty',
            openspec_root: { present: true, healthy: true, future: true },
            metadata: { present: false },
            git: { is_repository: null },
          },
        ],
      })
    ).toMatchObject({
      stores: [{ id: 'empty', openspec_root: { present: true, healthy: true } }],
    })
  })
})

describe('classifyStoreCliResult (beta fault-tolerance classification)', () => {
  it('classifies a successful, parseable output as ok', () => {
    const result = classifyStoreCliResult({
      result: evidence({ payload: { stores: [{ id: 'team', root: '/x' }], status: [] } }),
      schema: StoreListResultSchema,
    })
    expect(result.kind).toBe('ok')
  })

  it('tolerates additive CLI fields (lenient passthrough) and stays ok', () => {
    const result = classifyStoreCliResult({
      result: evidence({
        payload: {
          stores: [{ id: 'team', root: '/x', extra: 'future-field' }],
          status: [],
          unknownTopLevel: true,
        },
      }),
      schema: StoreListResultSchema,
    })
    expect(result.kind).toBe('ok')
  })

  it('classifies exit-0-but-unparseable output as data-incompatible (异常一) with version source', () => {
    const result = classifyStoreCliResult({
      result: evidence({ payload: null, stdout: '{ not valid json' }),
      schema: StoreListResultSchema,
      cliVersion: '1.5.0',
    })
    expect(result.kind).toBe('data-incompatible')
    if (result.kind === 'data-incompatible') {
      expect(result.cliVersion).toBe('1.5.0')
      expect(result.message).toMatch(/incompatible stores payload/)
    }
  })

  it('classifies non-zero exit as command-unavailable (异常二) with version source', () => {
    const result = classifyStoreCliResult({
      result: evidence({ success: false, stdout: '', stderr: 'error: unknown command' }),
      schema: StoreListResultSchema,
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
  it('returns available=true with parsed stores for ok classification', () => {
    const cls = classifyStoreCliResult({
      result: evidence({ payload: { stores: [{ id: 'a', root: '/a' }], status: [] } }),
      schema: StoreListResultSchema,
    })
    const result = toStoreFeatureResult(cls, {
      fromData: (data) => StoreListResultSchema.parse(data).stores,
      fallback: [],
      cliVersion: '1.5.0',
    })
    expect(result.available).toBe(true)
    expect(result.stores).toHaveLength(1)
    expect(result.cliVersion).toBe('1.5.0')
    expect(result.error).toBeUndefined()
  })

  it('returns available=false with fallback and error for data-incompatible', () => {
    const cls = classifyStoreCliResult({
      result: evidence({ payload: null, stdout: 'broken' }),
      schema: StoreListResultSchema,
      cliVersion: '1.5.0',
    })
    const result = toStoreFeatureResult(cls, { fromData: () => [], fallback: [] })
    expect(result.available).toBe(false)
    expect(result.stores).toEqual([])
    expect(result.error?.kind).toBe('data-incompatible')
  })

  it('returns available=false with fallback and error for command-unavailable', () => {
    const cls = classifyStoreCliResult({
      result: evidence({ success: false, stdout: '', stderr: 'no such command' }),
      schema: StoreListResultSchema,
    })
    const result = toStoreFeatureResult(cls, { fromData: () => [], fallback: [] })
    expect(result.available).toBe(false)
    expect(result.stores).toEqual([])
    expect(result.error?.kind).toBe('command-unavailable')
  })
})
