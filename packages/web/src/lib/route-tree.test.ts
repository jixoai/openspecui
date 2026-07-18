/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Prove the live project route tree registers Context and rejects the retired Stores route.
 * 2. Prove the static project route tree preserves the same Context replacement boundary.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 */
import { createRootRoute } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { createRouteTree } from './route-tree'
import { createStaticRouteTree } from './route-tree-static'

function registeredPaths(routeTree: ReturnType<typeof createRouteTree>): string[] {
  return routeTree.children?.map((route) => route.options.path ?? '/') ?? []
}

describe('project route trees', () => {
  it('registers Context and omits Stores in the live route tree', () => {
    const paths = registeredPaths(createRouteTree(createRootRoute(), { includeTerminal: false }))

    expect(paths).toContain('/context')
    expect(paths).not.toContain('/stores')
  })

  it('registers Context and omits Stores in the static route tree', () => {
    const paths = registeredPaths(createStaticRouteTree(createRootRoute()))

    expect(paths).toContain('/context')
    expect(paths).not.toContain('/stores')
  })
})
