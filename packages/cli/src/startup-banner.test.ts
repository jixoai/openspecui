import { describe, expect, it } from 'vitest'
import { buildStartupBanner } from './startup-banner.js'

describe('buildStartupBanner', () => {
  it('includes the version and project path in the startup output', () => {
    const banner = buildStartupBanner({
      projectDir: '/repo/example',
      version: '2.1.5',
    })
    const lines = banner.trim().split('\n')

    expect(banner).toContain('OpenSpec UI v2.1.5')
    expect(banner).toContain('📁 Project: /repo/example')
    const versionLine = lines.find((line) => line.includes('OpenSpec UI v2.1.5'))
    expect(versionLine).toBe('│             OpenSpec UI v2.1.5              │')
    expect(versionLine?.length).toBe(lines[0]?.length)
  })
})
