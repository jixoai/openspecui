export type VTArea = 'main' | 'bottom' | 'pop'
export type RouteLevel = 'top' | 'detail' | 'pop'
export type VTKind = 'route-top' | 'route-detail' | 'tab-carousel'
export type VTDirection = 'forward' | 'backward'

export interface RouteSemantic {
  family: string
  level: RouteLevel
}

export interface VTIntent {
  area: VTArea
  kind: VTKind
  direction?: VTDirection
}

interface RouteSemanticMatcher extends RouteSemantic {
  pattern: RegExp
}

const ROUTE_SEMANTICS: readonly RouteSemanticMatcher[] = [
  { family: 'search', level: 'pop', pattern: /^\/search(?:\/|$)/ },
  { family: 'opsx-new', level: 'pop', pattern: /^\/opsx-new(?:\/|$)/ },
  { family: 'opsx-propose', level: 'pop', pattern: /^\/opsx-propose(?:\/|$)/ },
  { family: 'opsx-verify', level: 'pop', pattern: /^\/opsx-verify(?:\/|$)/ },
  { family: 'opsx-compose', level: 'pop', pattern: /^\/opsx-compose(?:\/|$)/ },
  { family: 'dashboard', level: 'top', pattern: /^\/dashboard$/ },
  { family: 'config', level: 'top', pattern: /^\/config$/ },
  { family: 'git', level: 'detail', pattern: /^\/git\/(?:uncommitted|commit\/[^/]+)$/ },
  { family: 'git', level: 'top', pattern: /^\/git$/ },
  { family: 'specs', level: 'detail', pattern: /^\/specs\/[^/]+$/ },
  { family: 'specs', level: 'top', pattern: /^\/specs$/ },
  { family: 'changes', level: 'detail', pattern: /^\/changes\/[^/]+$/ },
  { family: 'changes', level: 'top', pattern: /^\/changes$/ },
  { family: 'archive', level: 'detail', pattern: /^\/archive\/[^/]+$/ },
  { family: 'archive', level: 'top', pattern: /^\/archive$/ },
  { family: 'settings', level: 'top', pattern: /^\/settings$/ },
  { family: 'terminal', level: 'top', pattern: /^\/terminal$/ },
]

function normalizePathname(pathname: string): string {
  if (!pathname) return '/'
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`
  return normalized !== '/' ? normalized.replace(/\/+$/, '') : normalized
}

export function describeRouteSemantic(pathname: string): RouteSemantic {
  const normalizedPath = normalizePathname(pathname)

  for (const semantic of ROUTE_SEMANTICS) {
    if (semantic.pattern.test(normalizedPath)) {
      return semantic
    }
  }

  return {
    family: normalizedPath === '/' ? 'root' : 'unknown',
    level: normalizedPath === '/' ? 'top' : 'detail',
  }
}

export function resolveViewTransitionIntent(options: {
  area: VTArea
  fromPath: string
  toPath: string
}): VTIntent | null {
  const fromPath = normalizePathname(options.fromPath)
  const toPath = normalizePathname(options.toPath)
  if (fromPath === toPath) return null

  const fromSemantic = describeRouteSemantic(fromPath)
  const toSemantic = describeRouteSemantic(toPath)

  if (options.area === 'pop') {
    const fromIsPop = fromSemantic.level === 'pop'
    const toIsPop = toSemantic.level === 'pop'
    if (!fromIsPop && !toIsPop) {
      return null
    }

    return {
      area: options.area,
      kind: 'route-top',
      direction: toIsPop ? 'forward' : 'backward',
    }
  }

  if (fromSemantic.level === 'pop' || toSemantic.level === 'pop') {
    return null
  }

  const isSameFamily = fromSemantic.family === toSemantic.family
  const involvesDetail = fromSemantic.level === 'detail' || toSemantic.level === 'detail'

  if (isSameFamily && involvesDetail) {
    return {
      area: options.area,
      kind: 'route-detail',
      direction: toSemantic.level === 'detail' ? 'forward' : 'backward',
    }
  }

  return {
    area: options.area,
    kind: 'route-top',
    direction: 'forward',
  }
}
