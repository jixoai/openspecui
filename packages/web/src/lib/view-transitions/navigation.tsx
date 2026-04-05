import { navController } from '@/lib/nav-controller'
import {
  Link as RouterLink,
  useLocation,
  useNavigate,
  type LinkComponentProps,
} from '@tanstack/react-router'
import { forwardRef, useCallback, type MouseEvent, type RefObject } from 'react'
import { prepareRouteDetailViewTransition } from './detail-prepare'
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
  pathname: string
  update: () => void
  collectBeforeEntries?: () => Array<[HTMLElement, string]>
  collectAfterEntries?: () => Array<[HTMLElement, string]>
}): Promise<void> {
  const prepareOutcome = await prepareRouteDetailViewTransition({
    intent: options.intent,
    pathname: options.pathname,
  })

  if (prepareOutcome === 'cancelled') {
    return
  }

  if (prepareOutcome === 'skip-vt') {
    await runViewTransition({
      intent: null,
      update: options.update,
    })
    return
  }

  await runViewTransition({
    intent: options.intent,
    collectBeforeEntries: options.collectBeforeEntries,
    collectAfterEntries: options.collectAfterEntries,
    update: options.update,
  })
}

export function useVTHrefNavigate() {
  const navigate = useNavigate()
  const location = useLocation()

  return useCallback(
    ({ href, replace = false, state, vt }: NavigateByHrefOptions) => {
      const relativeHref = toRelativeHref(href)
      const pathname = toPathname(href)
      const area = vt?.area ?? navController.getAreaForPath(pathname)
      const sourceRoot = resolveSource(vt?.source, null)
      const intent = resolveViewTransitionIntent({
        area,
        fromPath: location.pathname,
        toPath: pathname,
      })

      return runPreparedViewTransition({
        intent,
        pathname,
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

  const pathname = toPathname(options.href)
  const currentLocation = navController.getLocation(options.area)
  const sourceRoot = resolveSource(options.source, null)
  const intent = resolveViewTransitionIntent({
    area: options.area,
    fromPath: currentLocation.pathname,
    toPath: pathname,
  })

  return runPreparedViewTransition({
    intent,
    pathname,
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
  activatePop(href: string): void {
    navController.activatePop(href)
  },
  deactivatePop(): void {
    navController.deactivatePop()
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
