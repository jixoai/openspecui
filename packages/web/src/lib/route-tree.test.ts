/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove every Config owner has a focused live route and Resolved Context remains canonical.
 * 2. Prove static Config registers only publication-safe read-only routes.
 * 3. Prove retired top-level Context/Stores and live-only Config owners stay absent from static publication.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Owner Context direction (2026-07-29): `/config/context` is the single canonical route.
 * Owner Config-workbench decision (2026-08-01): `/config/agents` is live-only and absent from static publication.
 * Original request (2026-08-01): replace fixed-owner and dynamic Schema tabs with route-backed Config pages.
 */
import { createRootRoute } from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { ConfigAgents } from '../routes/config-agents'
import { ConfigEnvironment } from '../routes/config-environment'
import { ConfigProject } from '../routes/config-project'
import { ConfigRoot } from '../routes/config-root'
import { ConfigSchemaCatalog } from '../routes/config-schema-catalog'
import { ConfigSchemaDetail } from '../routes/config-schema-detail'
import { ContextView } from '../routes/context'
import { createRouteTree } from './route-tree'
import { createStaticRouteTree } from './route-tree-static'

vi.mock('../routes/dashboard', () => ({ Dashboard: () => null }))
vi.mock('../routes/settings', () => ({ Settings: () => null }))
vi.mock('../routes/terminal', () => ({ TerminalPage: () => null }))
vi.mock('@/lib/terminal-context', () => ({ useTerminalContext: () => ({}) }))
vi.mock('@/lib/terminal-controller', () => ({ terminalController: {} }))

function registeredPaths(
  routeTree: ReturnType<typeof createRouteTree> | ReturnType<typeof createStaticRouteTree>
): string[] {
  return routeTree.children?.map((route) => route.options.path ?? '/') ?? []
}

function registeredComponents(routeTree: ReturnType<typeof createRouteTree>) {
  return new Map(
    routeTree.children?.map(
      (route) => [route.options.path ?? '/', route.options.component] as const
    )
  )
}

describe('project route trees', () => {
  it('declares focused live routes for every Config owner', () => {
    const routeTree = createRouteTree(createRootRoute(), { includeTerminal: false })
    const components = registeredComponents(routeTree)
    const routes = [
      ['/config/project', ConfigProject],
      ['/config/root', ConfigRoot],
      ['/config/environment', ConfigEnvironment],
      ['/config/agents', ConfigAgents],
      ['/config/schemas', ConfigSchemaCatalog],
      ['/config/schemas/$schemaId', ConfigSchemaDetail],
      ['/config/context', ContextView],
    ] as const

    for (const [path, component] of routes) {
      expect(components.get(path)).toBe(component)
    }
    const paths = registeredPaths(routeTree)
    expect(paths).not.toContain('/context')
    expect(paths).not.toContain('/stores')
  })

  it('registers only publication-safe Config routes in the static route tree', () => {
    const paths = registeredPaths(createStaticRouteTree(createRootRoute()))

    expect(paths).toContain('/config/root')
    expect(paths).toContain('/config/schemas')
    expect(paths).toContain('/config/schemas/$schemaId')
    expect(paths).toContain('/config/context')
    expect(paths).not.toContain('/config/project')
    expect(paths).not.toContain('/config/environment')
    expect(paths).not.toContain('/config/agents')
    expect(paths).not.toContain('/context')
    expect(paths).not.toContain('/stores')
  })
})
