import { createRoute, type AnyRootRoute, type AnyRoute } from '@tanstack/react-router'
import { ArchiveList } from '../routes/archive-list'
import { ArchiveView } from '../routes/archive-view'
import { ChangeList } from '../routes/change-list'
import { ChangeView } from '../routes/change-view'
import { Config } from '../routes/config'
import { Dashboard } from '../routes/dashboard'
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
    createRoute({ getParentRoute: () => rootRoute, path: '/specs', component: SpecList }),
    createRoute({ getParentRoute: () => rootRoute, path: '/specs/$specId', component: SpecView }),
    createRoute({ getParentRoute: () => rootRoute, path: '/changes', component: ChangeList }),
    createRoute({
      getParentRoute: () => rootRoute,
      path: '/changes/$changeId',
      component: ChangeView,
    }),
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
