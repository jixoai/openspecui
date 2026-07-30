/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove only the source CLI runtime admits automatic native DevTools.
 *
 * Owner correction (2026-07-30): "pnpm openspecui这种开发模式下，应该要启动 opentray 的 devtools。"
 */
import { describe, expect, it } from 'vitest'
import { isDevelopmentCliRuntime } from './daemon-process.js'

describe('daemon process development boundary', () => {
  it('enables DevTools for source runtime and disables them for packaged dist', () => {
    expect(isDevelopmentCliRuntime('/repo/packages/cli/src')).toBe(true)
    expect(isDevelopmentCliRuntime('/repo/packages/cli/dist')).toBe(false)
    expect(isDevelopmentCliRuntime('/install/node_modules/openspecui/dist')).toBe(false)
  })
})
