/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove which acknowledged hosted launches retire their transient source Document.
 * 2. Preserve locally applied and fallback-applied App surfaces.
 *
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 * Owner correction (2026-07-31): PWA launch settlement is retired.
 */
import { describe, expect, it, vi } from 'vitest'
import type { HostedLaunchDispatchResult } from '../lib/launch-relay'
import { retireHostedLaunchSourceBestEffort } from './app-launch-owner'

describe('App launch source retirement', () => {
  it.each(['forwarded'] satisfies HostedLaunchDispatchResult[])(
    'retires the transient source after %s acknowledgement',
    (result) => {
      const closeSource = vi.fn()
      retireHostedLaunchSourceBestEffort(result, closeSource)
      expect(closeSource).toHaveBeenCalledOnce()
    }
  )

  it.each(['applied', 'fallback-applied'] satisfies HostedLaunchDispatchResult[])(
    'keeps the source mounted when the request is %s',
    (result) => {
      const closeSource = vi.fn()
      retireHostedLaunchSourceBestEffort(result, closeSource)
      expect(closeSource).not.toHaveBeenCalled()
    }
  )
})
