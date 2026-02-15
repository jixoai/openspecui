import { createHistory, type RouterHistory } from '@tanstack/react-router'
import type { NavController } from './nav-controller'

/**
 * Create a custom TanStack Router history backed by the navController.
 *
 * Each area ('main' | 'bottom') gets its own RouterHistory where:
 * - getLocation() reads from navController's virtual path for that area
 * - pushState/replaceState delegate to navController, which serializes to browser URL
 * - go/back/forward delegate to window.history, triggering popstate → navController
 *
 * The returned RouterHistory has a notify() method the navController calls on popstate
 * to make the router re-render.
 */
export function createNavHistory(
  area: 'main' | 'bottom',
  controller: NavController
): RouterHistory {
  const history = createHistory({
    getLocation() {
      return controller.getLocation(area)
    },
    getLength() {
      return window.history.length
    },
    pushState(path: string, state: any) {
      controller.push(area, path, state)
    },
    replaceState(path: string, state: any) {
      controller.replace(area, path, state)
    },
    go(n: number) {
      window.history.go(n)
    },
    back() {
      window.history.back()
    },
    forward() {
      window.history.forward()
    },
    createHref(path: string) {
      return path
    },
  })

  // Register with navController so it can call history.notify() on popstate
  controller.setHistoryRef(area, history)

  return history
}
