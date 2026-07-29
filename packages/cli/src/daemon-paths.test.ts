/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove daemon paths are user-global, project-independent, and platform-bounded.
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
})
