import { describe, expect, it } from 'vitest'
import { resolvePtyCommand, type PtyPlatform } from './pty-manager.js'

describe('resolvePtyCommand', () => {
  it('uses explicit command and args when provided', () => {
    const result = resolvePtyCommand({
      platform: 'windows',
      command: 'pwsh.exe',
      args: ['-NoProfile'],
      env: {},
    })

    expect(result).toEqual({
      command: 'pwsh.exe',
      args: ['-NoProfile'],
    })
  })

  it('uses ComSpec on windows when command is not provided', () => {
    const result = resolvePtyCommand({
      platform: 'windows',
      env: {
        ComSpec: 'C:\\Windows\\System32\\cmd.exe',
      },
    })

    expect(result).toEqual({
      command: 'C:\\Windows\\System32\\cmd.exe',
      args: [],
    })
  })

  it('falls back to cmd.exe on windows when ComSpec is missing', () => {
    const result = resolvePtyCommand({
      platform: 'windows',
      env: {},
    })

    expect(result).toEqual({
      command: 'cmd.exe',
      args: [],
    })
  })

  it.each([
    ['macos', '/bin/zsh'],
    ['common', '/bin/bash'],
  ] as const)(
    'uses SHELL on unix-like platforms (%s)',
    (platform: Exclude<PtyPlatform, 'windows'>, shell) => {
      const result = resolvePtyCommand({
        platform,
        env: {
          SHELL: shell,
        },
      })

      expect(result).toEqual({
        command: shell,
        args: [],
      })
    }
  )

  it('falls back to /bin/sh on unix-like platforms when SHELL is missing', () => {
    const result = resolvePtyCommand({
      platform: 'common',
      env: {},
    })

    expect(result).toEqual({
      command: '/bin/sh',
      args: [],
    })
  })
})
