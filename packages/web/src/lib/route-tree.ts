/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Register the canonical live project route tree, Config-owned Context, and objective Kanban.
 * 2. Register pop-layer workflows independently from project workspace tabs.
 * 3. Keep terminal registration configurable for hosted project surfaces.
 *
 * Original request (2026-07-15): "我们这个项目本身只是 OpenSpec 的一个可视化投影，所以保持客观中立很重要。"
 * Derived requirement (2026-07-18): Checkpoint 6.9 replaces the project Stores route with Context.
 * Original request (2026-07-28): add the objective Kanban project surface.
 * Owner Context direction (2026-07-29): make `/config/context` the only live Context route.
 */
import { createRoute, type AnyRootRoute, type AnyRoute } from '@tanstack/react-router'
import { ArchiveList } from '../routes/archive-list'
import { ArchiveView } from '../routes/archive-view'
import { Board } from '../routes/board'
import { ChangeList } from '../routes/change-list'
import { ChangeView } from '../routes/change-view'
import { Config } from '../routes/config'
import { ContextView } from '../routes/context'
import { Dashboard } from '../routes/dashboard'
import { GitRoute } from '../routes/git'
import { GitCommitViewRoute, GitUncommittedViewRoute } from '../routes/git-view'
import { NotificationsRoute } from '../routes/notifications'
import { OpsxComposeRoute } from '../routes/opsx-compose'
import { OpsxNewRoute } from '../routes/opsx-new'
import { OpsxProposeRoute } from '../routes/opsx-propose'
import { OpsxVerifyRoute } from '../routes/opsx-verify'
import { SearchRoute } from '../routes/search'
import { Settings } from '../routes/settings'
import { SpecList } from '../routes/spec-list'
import { SpecView } from '../routes/spec-view'
import { TerminalPage } from '../routes/terminal'

/** Create the interactive route tree (includes terminal route by default). */
export function createRouteTree(rootRoute: AnyRootRoute, opts?: { includeTerminal?: boolean }) {
  const routes: AnyRoute[] = [
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => null,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: '/dashboard', component: Dashboard }),
    createRoute({ getParentRoute: () => rootRoute, path: '/config', component: Config }),
    createRoute({ getParentRoute: () => rootRoute, path: '/git', component: GitRoute }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/git/uncommitted',
      component: GitUncommittedViewRoute,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/git/commit/$hash',
      component: GitCommitViewRoute,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: '/specs', component: SpecList }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/specs/owned/$specId',
      component: SpecView,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/specs/referenced/$storeId/$specId',
      component: SpecView,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/config/context',
      component: ContextView,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: '/changes', component: ChangeList }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/changes/$changeId',
      component: ChangeView,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: '/board', component: Board }),
    createRoute({ getParentRoute: () => rootRoute, path: '/archive', component: ArchiveList }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/archive/$changeId',
      component: ArchiveView,
    }),
    createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings }),
  ]

  if (opts?.includeTerminal !== false) {
    routes.push(
      createRoute({ getParentRoute: () => rootRoute, path: '/terminal', component: TerminalPage })
    )
  }

  return rootRoute.addChildren(routes)
}

/** Create the independent pop-layer route tree. */
export function createPopRouteTree(rootRoute: AnyRootRoute) {
  return rootRoute.addChildren([
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => null,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/search',
      component: SearchRoute,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/notifications',
      component: NotificationsRoute,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/opsx-new',
      component: OpsxNewRoute,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/opsx-propose',
      component: OpsxProposeRoute,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/opsx-verify',
      component: OpsxVerifyRoute,
    }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/opsx-compose',
      component: OpsxComposeRoute,
    }),
  ])
}
