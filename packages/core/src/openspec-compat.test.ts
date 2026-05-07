import { describe, expect, it } from 'vitest'
import {
  OPENSPEC_CLI_ACCEPTED_RANGE,
  classifyOpenSpecCliVersion,
  parseOpenSpecCliVersion,
} from './openspec-compat.js'

describe('openspec CLI compatibility law', () => {
  it('parses versions from raw CLI output', () => {
    expect(parseOpenSpecCliVersion('1.3.1')).toEqual({ major: 1, minor: 3, patch: 1 })
    expect(parseOpenSpecCliVersion('openspec 1.2.0')).toEqual({
      major: 1,
      minor: 2,
      patch: 0,
    })
  })

  it('classifies 1.3.x as the current OpenSpecUI 3.x target line', () => {
    expect(classifyOpenSpecCliVersion('1.3.1')).toMatchObject({
      status: 'current',
      supported: true,
      recommended: true,
      blocksCoreInteractions: false,
    })
  })

  it('classifies 1.2.x as backward-compatible but not recommended', () => {
    expect(classifyOpenSpecCliVersion('1.2.0')).toMatchObject({
      status: 'legacy-compatible',
      supported: true,
      recommended: false,
      blocksCoreInteractions: false,
    })
  })

  it('blocks versions outside the 3.x accepted range', () => {
    expect(classifyOpenSpecCliVersion('1.1.1')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.4.0')).toMatchObject({
      status: 'unsupported',
      supported: false,
      blocksCoreInteractions: true,
    })
    expect(classifyOpenSpecCliVersion('1.4.0').message).toContain(OPENSPEC_CLI_ACCEPTED_RANGE)
  })

  it('blocks unknown versions', () => {
    expect(classifyOpenSpecCliVersion('dev')).toMatchObject({
      status: 'unknown',
      supported: false,
      blocksCoreInteractions: true,
    })
  })
})
