/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove daemon paths are user-global, project-independent, platform-bounded, and explicitly isolatable.
 * 2. Prove equivalent Windows home spellings share one named-pipe identity.
 *
 * Windows correction (2026-08-04): explicit OpenSpecUI homes must not share one named pipe.
 *
 * Original request (2026-07-29): "start/stop/restart 针对 daemon。"
 */
import { describe, expect, it } from 'vitest'
import { resolveDaemonPaths } from './daemon-paths.js'

describe('daemon runtime paths', () => {
  it('uses a private OpenSpecUI home for Unix runtime and logs', () => {
    expect(resolveDaemonPaths({ platform: 'darwin', userHome: '/Users/tester' })).toEqual({
      homeDir: '/Users/tester/.openspecui',
      runDir: '/Users/tester/.openspecui/run',
      logsDir: '/Users/tester/.openspecui/logs',
      endpoint: '/Users/tester/.openspecui/run/daemon.sock',
      logFile: '/Users/tester/.openspecui/logs/daemon.log',
    })
  })

  it('derives a deterministic home-scoped Windows pipe without exposing the home path', () => {
    const first = resolveDaemonPaths({ platform: 'win32', userHome: 'C:\\Users\\tester' })
    const second = resolveDaemonPaths({ platform: 'win32', userHome: 'C:\\Users\\tester' })

    expect(first.endpoint).toBe(second.endpoint)
    expect(first.endpoint).toMatch(/^\\\\\.\\pipe\\openspecui-[a-f0-9]{16}$/)
    expect(first.endpoint).not.toContain('tester')
  })

  it('isolates the Windows pipe when an explicit OpenSpecUI home is selected', () => {
    const first = resolveDaemonPaths({
      platform: 'win32',
      userHome: 'C:\\Users\\tester',
      openspecuiHome: 'D:\\OpenSpecUI\\first',
    })
    const second = resolveDaemonPaths({
      platform: 'win32',
      userHome: 'C:\\Users\\tester',
      openspecuiHome: 'D:\\OpenSpecUI\\second',
    })

    expect(first.endpoint).not.toBe(second.endpoint)
  })

  it('normalizes Windows case, separator, and trailing-slash aliases before hashing', () => {
    const variants = ['D:\\OpenSpecUI\\Home', 'd:/openspecui/home', 'D:\\OPENSPECUI\\HOME\\'].map(
      (openspecuiHome) =>
        resolveDaemonPaths({
          platform: 'win32',
          userHome: 'C:\\Users\\tester',
          openspecuiHome,
        })
    )

    expect(new Set(variants.map((paths) => paths.endpoint))).toHaveLength(1)
  })
})
