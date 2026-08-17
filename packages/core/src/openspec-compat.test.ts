/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Prove parsing of real OpenSpec CLI version output.
 * 2. Prove OpenSpecUI 9 supports the accepted 1.8/1.9 range and recommends the 1.9 line.
 * 3. Prove older, future, prerelease, and unknown CLI versions remain blocked by default.
 *
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 * Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { describe, expect, it } from 'vitest'
import {
  classifyOpenSpecCliVersion,
  deriveOpenSpecCliCapabilities,
  OPENSPEC_CLI_ACCEPTED_RANGE,
  OPENSPEC_CLI_RECOMMENDED_RANGE,
  OPENSPECUI_TARGET_MAJOR,
  parseOpenSpecCliVersion,
} from './openspec-compat.js'

describe('openspec CLI compatibility law', () => {
  it('parses versions from raw CLI output', () => {
    expect(parseOpenSpecCliVersion('1.9.0')).toEqual({
      major: 1,
      minor: 9,
      patch: 0,
      prerelease: null,
    })
    expect(parseOpenSpecCliVersion('openspec 1.8.0')).toEqual({
      major: 1,
      minor: 8,
      patch: 0,
      prerelease: null,
    })
    expect(parseOpenSpecCliVersion('openspec 1.9.0-rc.1')).toEqual({
      major: 1,
      minor: 9,
      patch: 0,
      prerelease: 'rc.1',
    })
  })

  it('classifies the 1.9 line as the current recommended OpenSpecUI 9 target line', () => {
    for (const version of ['1.9.0', '1.9.1', 'openspec 1.9.3']) {
      expect(classifyOpenSpecCliVersion(version)).toMatchObject({
        status: 'current',
        supported: true,
        recommended: true,
        blocksCoreInteractions: false,
      })
    }
  })

  it('classifies the 1.8 line as supported non-current', () => {
    for (const version of ['1.8.0', '1.8.1']) {
      const compatibility = classifyOpenSpecCliVersion(version)
      expect(compatibility).toMatchObject({
        status: 'supported',
        supported: true,
        recommended: false,
        blocksCoreInteractions: false,
      })
      expect(compatibility.message).toContain(OPENSPEC_CLI_ACCEPTED_RANGE)
      expect(compatibility.message).toContain(OPENSPEC_CLI_RECOMMENDED_RANGE)
    }
  })

  it('blocks versions outside the OpenSpecUI 9 accepted range', () => {
    expect(classifyOpenSpecCliVersion('1.7.0-rc.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.7.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.6.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
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
    expect(classifyOpenSpecCliVersion('1.10.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
  })

  it('blocks every prerelease, including prereleases inside the accepted range', () => {
    expect(classifyOpenSpecCliVersion('1.8.0-rc.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.9.0-rc.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.9.1-beta.2')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
  })

  it('names the accepted and recommended ranges in mismatch evidence', () => {
    const message = classifyOpenSpecCliVersion('1.7.0').message
    expect(message).toContain(OPENSPEC_CLI_ACCEPTED_RANGE)
    expect(message).toContain(OPENSPEC_CLI_RECOMMENDED_RANGE)
    expect(message).toContain(`${OPENSPECUI_TARGET_MAJOR}.x`)
  })

  it('blocks unknown versions', () => {
    expect(classifyOpenSpecCliVersion('dev')).toMatchObject({
      status: 'unknown',
      supported: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion(undefined)).toMatchObject({
      status: 'unknown',
      supported: false,
      blocksCoreInteractions: true,
    })
  })
})

describe('deriveOpenSpecCliCapabilities admission boundary', () => {
  it('grants 1.9 capabilities only to admitted stable versions', () => {
    expect(deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.9.0'))).toEqual({
      schemasRootSelector: true,
      archivedValidation: true,
    })
    expect(deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.8.5'))).toEqual({
      schemasRootSelector: false,
      archivedValidation: false,
    })
  })

  it('grants no capabilities to bypassed unsupported or unparseable versions', () => {
    for (const raw of [
      '1.9.0-rc.1',
      '1.9.0-beta.2',
      '1.10.0',
      '2.0.0',
      '1.7.9',
      'garbage',
      undefined,
    ]) {
      expect(deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion(raw))).toEqual({
        schemasRootSelector: false,
        archivedValidation: false,
      })
    }
    expect(deriveOpenSpecCliCapabilities(null)).toEqual({
      schemasRootSelector: false,
      archivedValidation: false,
    })
  })
})
