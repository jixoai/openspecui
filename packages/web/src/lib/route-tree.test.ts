/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Prove live and static route trees register Config-owned Resolved Context.
 * 2. Prove retired top-level Context and Stores routes stay absent.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Owner Context direction (2026-07-29): `/config/context` is the single canonical route.
 */
import { createRootRoute } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { createRouteTree } from './route-tree'
import { createStaticRouteTree } from './route-tree-static'

function registeredPaths(routeTree: ReturnType<typeof createRouteTree>): string[] {
  return routeTree.children?.map((route) => route.options.path ?? '/') ?? []
}

describe('project route trees', () => {
  it('registers Config-owned Context and omits retired routes in the live route tree', () => {
    const paths = registeredPaths(createRouteTree(createRootRoute(), { includeTerminal: false }))

    expect(paths).toContain('/config/context')
    expect(paths).not.toContain('/context')
    expect(paths).not.toContain('/stores')
  })

  it('registers Config-owned Context and omits retired routes in the static route tree', () => {
    const paths = registeredPaths(createStaticRouteTree(createRootRoute()))

    expect(paths).toContain('/config/context')
    expect(paths).not.toContain('/context')
    expect(paths).not.toContain('/stores')
  })
})
