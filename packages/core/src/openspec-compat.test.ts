/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove parsing of real OpenSpec CLI version output.
 * 2. Prove OpenSpecUI 6.1 targets CLI 1.6 while accepting CLI 1.7 as compatible.
 * 3. Prove older, future, and unknown CLI versions remain blocked.
 *
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 */
import { describe, expect, it } from 'vitest'
import {
  OPENSPEC_CLI_ACCEPTED_RANGE,
  classifyOpenSpecCliVersion,
  parseOpenSpecCliVersion,
} from './openspec-compat.js'

describe('openspec CLI compatibility law', () => {
  it('parses versions from raw CLI output', () => {
    expect(parseOpenSpecCliVersion('1.7.0')).toEqual({ major: 1, minor: 7, patch: 0 })
    expect(parseOpenSpecCliVersion('openspec 1.6.0')).toEqual({
      major: 1,
      minor: 6,
      patch: 0,
    })
  })

  it('classifies the 1.6 target line as the current OpenSpecUI 6.1 target line', () => {
    expect(classifyOpenSpecCliVersion('1.6.0')).toMatchObject({
      status: 'current',
      supported: true,
      recommended: true,
      blocksCoreInteractions: false,
    })
  })

  it('classifies the 1.7 line as compatible but not adapted', () => {
    expect(classifyOpenSpecCliVersion('1.7.0')).toMatchObject({
      status: 'compatible',
      supported: true,
      recommended: false,
      blocksCoreInteractions: false,
    })
  })

  it('blocks versions outside the 6.x accepted range', () => {
    expect(classifyOpenSpecCliVersion('1.5.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.3.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.8.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.8.0').message).toContain(OPENSPEC_CLI_ACCEPTED_RANGE)
  })

  it('blocks unknown versions', () => {
    expect(classifyOpenSpecCliVersion('dev')).toMatchObject({
      status: 'unknown',
      supported: false,
      blocksCoreInteractions: true,
    })
  })
})
