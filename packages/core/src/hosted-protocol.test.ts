/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove envUri is opaque, stable per host+dataHome pair, and changes when either input changes.
 * 2. Prove capabilities are compatibility facts only.
 * 3. Prove mutation terminal classification and access-gate credential equality/constant-time safety.
 *
 * Original request (2026-07-15): "我们可以在 cli 上新增一个 --auth 或者 --password。"
 * Section 8 core hosted-protocol unit coverage.
 */
import { describe, expect, it } from 'vitest'
import {
  accessGateFingerprint,
  asEnvUri,
  computeEnvUri,
  constantTimeEqual,
  generateAccessGateCredential,
  hasCapability,
  isTerminalMutationStatus,
  normalizeAccessGatePassword,
} from './hosted-protocol.js'

describe('envUri', () => {
  it('is stable for the same host identity + data home pair', () => {
    const a = computeEnvUri({ hostIdentity: 'host-a', dataHome: '/data' })
    const b = computeEnvUri({ hostIdentity: 'host-a', dataHome: '/data' })
    expect(a).toBe(b)
  })

  it('changes when host identity or data home changes', () => {
    const base = computeEnvUri({ hostIdentity: 'host-a', dataHome: '/data' })
    expect(computeEnvUri({ hostIdentity: 'host-b', dataHome: '/data' })).not.toBe(base)
    expect(computeEnvUri({ hostIdentity: 'host-a', dataHome: '/other' })).not.toBe(base)
    expect(computeEnvUri({ hostIdentity: 'host-a', dataHome: null })).not.toBe(base)
  })

  it('is opaque and non-dereferenceable', () => {
    const uri = computeEnvUri({ hostIdentity: 'host-a', dataHome: '/data' })
    expect(uri.startsWith('openspecui-env://1/')).toBe(true)
    // The raw host/data-home values must not appear in the opaque URI.
    expect(uri).not.toContain('host-a')
    expect(uri).not.toContain('/data')
  })

  it('asEnvUri brands a backend-issued string without exposing construction', () => {
    const branded = asEnvUri('openspecui-env://1/abc')
    expect(branded).toBe('openspecui-env://1/abc')
  })
})

describe('capabilities', () => {
  it('reports advertised capabilities as compatibility facts', () => {
    expect(hasCapability(['stores.inspect', 'stores.mutate'], 'stores.inspect')).toBe(true)
    expect(hasCapability(['stores.inspect'], 'stores.mutate')).toBe(false)
    expect(hasCapability(undefined, 'contexts.inspect')).toBe(false)
  })
})

describe('store mutation lifecycle', () => {
  it('classifies terminal statuses', () => {
    expect(isTerminalMutationStatus('succeeded')).toBe(true)
    expect(isTerminalMutationStatus('failed')).toBe(true)
    expect(isTerminalMutationStatus('indeterminate')).toBe(true)
    expect(isTerminalMutationStatus('accepted')).toBe(false)
    expect(isTerminalMutationStatus('running')).toBe(false)
  })
})

describe('access gate credential', () => {
  it('generates a high-entropy Bearer credential with a complete header and fingerprint', () => {
    const gate = generateAccessGateCredential()
    expect(gate.authorizationHeader).toMatch(/^Bearer .+$/)
    expect(gate.credential.length).toBeGreaterThanOrEqual(32)
    expect(gate.fingerprint).toMatch(/^[0-9a-f]{16}$/)
    // Two generations produce distinct credentials.
    expect(generateAccessGateCredential().credential).not.toBe(gate.credential)
  })

  it('normalizes a --password secret into the same Bearer form, used verbatim', () => {
    const gate = normalizeAccessGatePassword('s3cret-pass')
    expect(gate.credential).toBe('s3cret-pass')
    expect(gate.authorizationHeader).toBe('Bearer s3cret-pass')
    expect(gate.fingerprint).toBe(accessGateFingerprint('s3cret-pass'))
  })

  it('constantTimeEqual compares secrets without leaking length mismatch', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true)
    expect(constantTimeEqual('abc', 'abd')).toBe(false)
    expect(constantTimeEqual('abc', 'abcd')).toBe(false)
    expect(constantTimeEqual('', '')).toBe(true)
  })
})
