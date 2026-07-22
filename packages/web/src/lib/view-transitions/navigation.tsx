/**
 * Orthogonal intents (updated 2026-07-22 Asia/Shanghai):
 * 1. Coordinate route navigation with native View Transitions.
 * 2. Preserve navigation state and shared-element descriptors across route areas.
 * 3. Forward Git binding provenance into detail prefetch before committing navigation.
 * 4. Record causally bounded preparation, route-update-issued, and transition-settlement timings.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 * Derived requirement (2026-07-19): Checkpoint 6.11 rejects stale Git handoff prefetch.
 * Original request (2026-07-22): "整个过程中，几乎都在 Loading，切换个页面也等，做任何动作也在等，给我的感觉就是非常卡。"
 */
import { navController } from '@/lib/nav-controller'
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  type LinkComponentProps,
} from '@tanstack/react-router'
import { forwardRef, useCallback, type MouseEvent, type RefObject } from 'react'
import { prepareRouteDetailViewTransition } from './detail-prepare'
import { startNavigationTimingAttempt } from './navigation-timing'
import { resolveViewTransitionIntent, type VTArea } from './route-semantics'
import { runViewTransition } from './runtime'
import { collectSharedElementEntries, type SharedElementDescriptor } from './shared-elements'

type VTSource = HTMLElement | null | RefObject<HTMLElement | null> | (() => HTMLElement | null)

interface VTNavigationConfig {
  area?: VTArea
  source?: VTSource
  sharedElements?: SharedElementDescriptor
}

interface NavigateByHrefOptions {
  href: string
  replace?: boolean
  state?: LinkComponentProps<'a'>['state']
  vt?: VTNavigationConfig
}

export interface VTLinkProps extends LinkComponentProps<'a'> {
  vt?: VTNavigationConfig
}

function toNavigateState(
  state: LinkComponentProps<'a'>['state']
): LinkComponentProps<'a'>['state'] extends infer T ? T : never {
  if (state === undefined || state === true) {
    return state
  }

  if (typeof state === 'function') {
    return state
  }

  return () => state
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.shiftKey
  )
}

function toRelativeHref(href: string): string {
  const url = new URL(href, window.location.origin)
  return `${url.pathname}${url.search}${url.hash}`
}

function toPathname(href: string): string {
  return new URL(href, window.location.origin).pathname
}

function resolveSource(
  source: VTSource | undefined,
  fallback: HTMLElement | null
): HTMLElement | null {
  if (!source) return fallback
  if (typeof source === 'function') return source()
  if ('current' in source) return source.current
  return source
}

async function runPreparedViewTransition(options: {
  intent: ReturnType<typeof resolveViewTransitionIntent>
  area: VTArea
  fromPath: string
  pathname: string
  search?: string
  state?: unknown
  update: () => void
  collectBeforeEntries?: () => Array<[HTMLElement, string]>
  collectAfterEntries?: () => Array<[HTMLElement, string]>
}): Promise<void> {
  const timing = startNavigationTimingAttempt({
    area: options.area,
    fromPath: options.fromPath,
    toPath: options.pathname,
  })
  let prepareOutcome: Awaited<ReturnType<typeof prepareRouteDetailViewTransition>>
  try {
    prepareOutcome = await prepareRouteDetailViewTransition({
      intent: options.intent,
      pathname: options.pathname,
      search: options.search,
      state: options.state,
    })
  } catch (error) {
    timing.recordPrepareFailed(error)
    throw error
  }
  timing.recordPrepareSettled(prepareOutcome)

  if (prepareOutcome === 'cancelled') {
    return
  }

  const update = () => {
    try {
      options.update()
    } catch (error) {
      timing.recordRouteUpdateFailed(error)
      throw error
    }
    timing.recordRouteUpdateIssued()
  }

  try {
    if (prepareOutcome === 'skip-vt') {
      await runViewTransition({
        intent: null,
        update,
      })
      timing.recordTransitionSettled()
      return
    }

    await runViewTransition({
      intent: options.intent,
      collectBeforeEntries: options.collectBeforeEntries,
      collectAfterEntries: options.collectAfterEntries,
      update,
    })
    timing.recordTransitionSettled()
  } catch (error) {
    timing.recordTransitionFailed(error)
    throw error
  }
}

export function useVTHrefNavigate() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    ({ href, replace = false, state, vt }: NavigateByHrefOptions) => {
      const relativeHref = toRelativeHref(href)
      const targetUrl = new URL(href, window.location.origin)
      const pathname = targetUrl.pathname
      const area = vt?.area ?? navController.getAreaForPath(pathname)
      const sourceRoot = resolveSource(vt?.source, null)
      const intent = resolveViewTransitionIntent({
        area,
        fromPath: location.pathname,
        toPath: pathname,
      })

      return runPreparedViewTransition({
        intent,
        area,
        fromPath: location.pathname,
        pathname,
        search: targetUrl.search,
        state,
        collectBeforeEntries: () => collectSharedElementEntries(sourceRoot, vt?.sharedElements),
        collectAfterEntries: () => collectSharedElementEntries(document, vt?.sharedElements),
        update: () => {
          void navigate({
            href: relativeHref,
            replace,
            state: toNavigateState(state),
          })
        },
      })
    },
    [location.pathname, navigate]
  )
}

export const VTLink = forwardRef<HTMLAnchorElement, VTLinkProps>(function VTLink(
  { onClick, target, replace, state, viewTransition: _viewTransition, vt, ...props },
  ref
) {
  const navigateByHref = useVTHrefNavigate()

  const handleClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event)
      if (!isPlainLeftClick(event) || target === '_blank') {
        return
      }
      if (event.currentTarget.origin !== window.location.origin) {
        return
      }

      event.preventDefault()
      void navigateByHref({
        href: event.currentTarget.href,
        replace,
        state,
        vt: {
          ...vt,
          source: vt?.source ?? event.currentTarget,
        },
      })
    },
    [navigateByHref, onClick, replace, state, target, vt]
  )

  return (
    <RouterLink
      ref={ref}
      {...props}
      replace={replace}
      state={state}
      target={target}
      viewTransition={false}
      onClick={handleClick}
    />
  )
})

interface VTNavControllerNavigateOptions {
  source?: VTSource
  sharedElements?: SharedElementDescriptor
}

function commitNavControllerNavigation(options: {
  area: VTArea
  href: string
  state?: unknown
  replace?: boolean
}): void {
  if (options.replace) {
    navController.replace(options.area, options.href, options.state)
    return
  }

  navController.push(options.area, options.href, options.state)
}

function runNavControllerTransition(options: {
  area: VTArea
  href: string
  state?: unknown
  replace?: boolean
  source?: VTSource
  sharedElements?: SharedElementDescriptor
}): Promise<void> {
  if (typeof navController.getLocation !== 'function') {
    commitNavControllerNavigation(options)
    return Promise.resolve()
  }

  const targetUrl = new URL(options.href, window.location.origin)
  const pathname = targetUrl.pathname
  const currentLocation = navController.getLocation(options.area)
  const sourceRoot = resolveSource(options.source, null)
  const intent = resolveViewTransitionIntent({
    area: options.area,
    fromPath: currentLocation.pathname,
    toPath: pathname,
  })

  return runPreparedViewTransition({
    intent,
    area: options.area,
    fromPath: currentLocation.pathname,
    pathname,
    search: targetUrl.search,
    state: options.state,
    collectBeforeEntries: () => collectSharedElementEntries(sourceRoot, options.sharedElements),
    collectAfterEntries: () => collectSharedElementEntries(document, options.sharedElements),
    update: () => {
      commitNavControllerNavigation(options)
    },
  })
}

export const vtNavController = {
  push(
    area: VTArea,
    href: string,
    state?: unknown,
    options?: VTNavControllerNavigateOptions
  ): Promise<void> {
    return runNavControllerTransition({
      area,
      href,
      state,
      source: options?.source,
      sharedElements: options?.sharedElements,
    })
  },
  replace(
    area: VTArea,
    href: string,
    state?: unknown,
    options?: VTNavControllerNavigateOptions
  ): Promise<void> {
    return runNavControllerTransition({
      area,
      href,
      state,
      replace: true,
      source: options?.source,
      sharedElements: options?.sharedElements,
    })
  },
  activateBottom(href: string): Promise<void> {
    if (typeof navController.getLocation !== 'function') {
      navController.activateBottom(href)
      return Promise.resolve()
    }

    const area: VTArea = 'bottom'
    const pathname = toPathname(href)

    return runViewTransition({
      intent: resolveViewTransitionIntent({
        area,
        fromPath: navController.getLocation(area).pathname,
        toPath: pathname,
      }),
      update: () => {
        navController.activateBottom(href)
      },
    })
  },
  deactivateBottom(): void {
    navController.deactivateBottom()
  },
  activatePop(href: string): Promise<void> {
    if (typeof navController.getLocation !== 'function') {
      navController.activatePop(href)
      return Promise.resolve()
    }

    const area: VTArea = 'pop'
    const pathname = toPathname(href)

    return runViewTransition({
      intent: resolveViewTransitionIntent({
        area,
        fromPath: navController.getLocation(area).pathname,
        toPath: pathname,
      }),
      update: () => {
        navController.activatePop(href)
      },
    })
  },
  deactivatePop(): Promise<void> {
    if (typeof navController.getLocation !== 'function') {
      navController.deactivatePop()
      return Promise.resolve()
    }

    const area: VTArea = 'pop'

    return runViewTransition({
      intent: resolveViewTransitionIntent({
        area,
        fromPath: navController.getLocation(area).pathname,
        toPath: '/',
      }),
      update: () => {
        navController.deactivatePop()
      },
    })
  },
  moveTab(...args: Parameters<typeof navController.moveTab>) {
    return navController.moveTab(...args)
  },
  reorder(...args: Parameters<typeof navController.reorder>) {
    return navController.reorder(...args)
  },
  closeTab(...args: Parameters<typeof navController.closeTab>) {
    return navController.closeTab(...args)
  },
  getAreaForPath(...args: Parameters<typeof navController.getAreaForPath>) {
    return navController.getAreaForPath(...args)
  },
  getLocation(...args: Parameters<typeof navController.getLocation>) {
    return navController.getLocation(...args)
  },
}
