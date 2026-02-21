import { createRoute, type AnyRootRoute } from '@tanstack/react-router'
import { ArchiveList } from '../routes/archive-list'
import { ArchiveView } from '../routes/archive-view'
import { ChangeList } from '../routes/change-list'
import { ChangeView } from '../routes/change-view'
import { Config } from '../routes/config'
import { Dashboard } from '../routes/dashboard'
import { SearchRoute } from '../routes/search'
import { SettingsStatic } from '../routes/settings-static'
import { SpecList } from '../routes/spec-list'
import { SpecView } from '../routes/spec-view'

/**
 * Static route tree (SSG/client-static) without terminal routes.
 */
export function createStaticRouteTree(rootRoute: AnyRootRoute) {
  return rootRoute.addChildren([
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
    createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsStatic }),
  ])
}

export function createStaticPopRouteTree(rootRoute: AnyRootRoute) {
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
  ])
}
