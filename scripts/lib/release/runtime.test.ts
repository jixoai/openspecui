import process from 'node:process'

import { afterEach, describe, expect, it } from 'vitest'

import { cloneCommandEnv, resolveCommandStdio } from './runtime'

const ORIGINAL_ENV = {
  CI: process.env.CI,
  FORCE_COLOR: process.env.FORCE_COLOR,
  NO_COLOR: process.env.NO_COLOR,
}

afterEach(() => {
  process.env.CI = ORIGINAL_ENV.CI
  process.env.FORCE_COLOR = ORIGINAL_ENV.FORCE_COLOR
  process.env.NO_COLOR = ORIGINAL_ENV.NO_COLOR
})

describe('cloneCommandEnv', () => {
  it('does not inject CI or color overrides into local release commands', () => {
    delete process.env.CI
    delete process.env.FORCE_COLOR
    delete process.env.NO_COLOR

    const env = cloneCommandEnv({ OTP_TEST: '1' })

    expect(env.OTP_TEST).toBe('1')
    expect('CI' in env).toBe(false)
    expect('FORCE_COLOR' in env).toBe(false)
    expect('NO_COLOR' in env).toBe(false)
  })

  it('preserves an explicitly configured parent environment value', () => {
    process.env.CI = 'existing'

    const env = cloneCommandEnv()

    expect(env.CI).toBe('existing')
  })
})

describe('resolveCommandStdio', () => {
  it('inherits the terminal for logged child commands', () => {
    expect(resolveCommandStdio('inherit')).toEqual({
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })
  })

  it('captures stdout and stderr for preflight commands', () => {
    expect(resolveCommandStdio('capture')).toEqual({
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    })
  })
})
