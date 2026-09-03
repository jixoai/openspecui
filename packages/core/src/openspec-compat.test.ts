/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Prove parsing of real OpenSpec CLI version output.
 * 2. Prove OpenSpecUI 12 admits only the single 1.12 series and recommends that line.
 * 3. Prove older lines (including the retired 1.10/1.11 v11 window), the future 1.13 series,
 *    prereleases, and unknown CLI versions remain blocked by default.
 * 4. Prove per-command capabilities follow the admitted series law: the 1.12 target series
 *    grants every capability including the findings report, and a bypassed unsupported
 *    version manufactures no command surface.
 *
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 * Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { describe, expect, it } from 'vitest'
import {
  classifyOpenSpecCliVersion,
  deriveOpenSpecCliCapabilities,
  OPENSPEC_CLI_ACCEPTED_RANGE,
  OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION,
  OPENSPEC_CLI_RECOMMENDED_RANGE,
  OPENSPEC_CLI_REFERENCE_TAG_PATTERN,
  OPENSPEC_CLI_SUPPORTED_SERIES,
  OPENSPEC_CLI_TARGET_SERIES,
  OPENSPECUI_TARGET_MAJOR,
  parseOpenSpecCliVersion,
} from './openspec-compat.js'

describe('openspec CLI compatibility law', () => {
  it('parses versions from raw CLI output', () => {
    expect(parseOpenSpecCliVersion('1.12.0')).toEqual({
      major: 1,
      minor: 12,
      patch: 0,
      prerelease: null,
    })
    expect(parseOpenSpecCliVersion('openspec 1.11.0')).toEqual({
      major: 1,
      minor: 11,
      patch: 0,
      prerelease: null,
    })
    expect(parseOpenSpecCliVersion('openspec 1.12.0-rc.1')).toEqual({
      major: 1,
      minor: 12,
      patch: 0,
      prerelease: 'rc.1',
    })
  })

  it('anchors the OpenSpecUI 12 single-series range constants verbatim', () => {
    expect(OPENSPECUI_TARGET_MAJOR).toBe(12)
    expect(OPENSPEC_CLI_TARGET_SERIES).toBe('1.12')
    expect([...OPENSPEC_CLI_SUPPORTED_SERIES]).toEqual(['1.12'])
    expect(OPENSPEC_CLI_ACCEPTED_RANGE).toBe('>=1.12.0 <1.13.0')
    expect(OPENSPEC_CLI_RECOMMENDED_RANGE).toBe('>=1.12.0 <1.13.0')
    // The next-series boundary keeps >=1.13.0 blocked; only a separate verified decision
    // may widen this single-series window.
    expect(OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION).toBe('1.13.0')
    expect(OPENSPEC_CLI_REFERENCE_TAG_PATTERN).toBe('v1.12.*')
  })

  it('classifies the 1.12 line as the current recommended OpenSpecUI 12 target line', () => {
    for (const version of ['1.12.0', '1.12.1', 'openspec 1.12.3']) {
      expect(classifyOpenSpecCliVersion(version)).toMatchObject({
        status: 'current',
        supported: true,
        recommended: true,
        blocksCoreInteractions: false,
      })
    }
  })

  it('blocks the retired 1.10/1.11 v11 window with actionable range copy', () => {
    for (const version of ['1.10.0', '1.10.5', '1.11.0', '1.11.2']) {
      const compatibility = classifyOpenSpecCliVersion(version)
      expect(compatibility).toMatchObject({
        status: 'unsupported',
        supported: false,
        recommended: false,
        blocksCoreInteractions: true,
      })
      expect(compatibility.message).toContain(OPENSPEC_CLI_ACCEPTED_RANGE)
      expect(compatibility.message).toContain(OPENSPEC_CLI_RECOMMENDED_RANGE)
    }
  })

  it('blocks versions below the OpenSpecUI 12 accepted range', () => {
    // 1.9.x was the v9 release line's target; 1.10/1.11 were the v11 window; v12 blocks
    // every older line by default.
    expect(classifyOpenSpecCliVersion('1.9.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.9.5')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.8.0')).toMatchObject({
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
    // The next-series boundary: 1.13.0 is outside the accepted range.
    expect(classifyOpenSpecCliVersion('1.13.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('2.0.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
  })

  it('blocks every prerelease, including prereleases inside the accepted range', () => {
    expect(classifyOpenSpecCliVersion('1.12.0-rc.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.12.1-beta.2')).toMatchObject({
      status: 'unsupported',
      supported: false,
      recommended: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.11.0-rc.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
  })

  it('names the accepted and recommended ranges in mismatch evidence', () => {
    const message = classifyOpenSpecCliVersion('1.11.0').message
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
  it('grants every capability, including the findings report, to the admitted 1.12 series', () => {
    expect(deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.12.0'))).toEqual({
      schemasRootSelector: true,
      archivedValidation: true,
      initLanguage: true,
      batchStatus: true,
      requirementDiff: true,
      findingsReport: true,
    })
    expect(deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion('1.12.5'))).toEqual({
      schemasRootSelector: true,
      archivedValidation: true,
      initLanguage: true,
      batchStatus: true,
      requirementDiff: true,
      findingsReport: true,
    })
  })

  it('grants no capabilities to bypassed unsupported or unparseable versions', () => {
    for (const raw of [
      '1.12.0-rc.1',
      '1.12.1-beta.2',
      '1.11.0',
      '1.10.0',
      '1.10.5',
      '1.9.0',
      '1.13.0',
      '2.0.0',
      'garbage',
      undefined,
    ]) {
      expect(deriveOpenSpecCliCapabilities(parseOpenSpecCliVersion(raw))).toEqual({
        schemasRootSelector: false,
        archivedValidation: false,
        initLanguage: false,
        batchStatus: false,
        requirementDiff: false,
        findingsReport: false,
      })
    }
    expect(deriveOpenSpecCliCapabilities(null)).toEqual({
      schemasRootSelector: false,
      archivedValidation: false,
      initLanguage: false,
      batchStatus: false,
      requirementDiff: false,
      findingsReport: false,
    })
  })
})
