/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove Projection Work registries belong to one Server-local runtime rather than a module global.
 * 2. Prove the runtime caps typed owner registries and clears its shared trace on teardown.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import { describe, expect, it } from 'vitest'
import {
  ProjectionWorkRuntime,
  ProjectionWorkRuntimeCapacityError,
  serverProjectionWorkCacheBudget,
} from './runtime.js'

describe('ProjectionWorkRuntime', () => {
  it('owns isolated typed registries and enforces the configured registry bound', () => {
    const runtime = new ProjectionWorkRuntime()
    const first = runtime.createRegistry<string>()
    const second = runtime.createRegistry<number>()

    expect(first).not.toBe(second)
    for (let index = 2; index < serverProjectionWorkCacheBudget.maxRegistryCount; index += 1) {
      runtime.createRegistry<string>()
    }
    expect(() => runtime.createRegistry<string>()).toThrow(ProjectionWorkRuntimeCapacityError)
    runtime.clear()
    expect(runtime.phaseTrace.read()).toEqual([])
  })
})
