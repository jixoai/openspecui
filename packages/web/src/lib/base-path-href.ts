/**
 * Orthogonal intents (created 2026-11-04 Asia/Shanghai):
 * 1. Own the one base-path string algebra both the router controller and the view-transition
 *    link wrapper need, so they cannot drift.
 * 2. Stay dependency-free: this module is imported by navigation code that unit tests replace
 *    with partial mocks of `nav-controller` and `static-mode`, so it must not read either.
 * 3. Strip the router's base path exactly once before handing a resolved href to `navigate()`
 *    (issue #319 #4: `/docs/` + `/docs/specs` used to become `/docs/docs/specs`).
 *
 * Original request (2026-11-04): "同时，处理一下#319"
 */

/** Normalize any authored base path to the `/segment/` form, or `/` for the site root. */
export function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.trim()
  if (!trimmed || trimmed === './' || trimmed === '.') return '/'
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
  return normalized.replace(/\/+/g, '/')
}

/** Remove the base path from a pathname, leaving non-matching paths untouched. */
export function stripBasePath(pathname: string, basePath: string): string {
  if (basePath === '/') return pathname || '/'
  if (pathname === basePath.slice(0, -1)) return '/'
  if (!pathname.startsWith(basePath)) return pathname || '/'
  const stripped = pathname.slice(basePath.length - 1)
  return stripped || '/'
}

/** Prefix a pathname with the base path. */
export function applyBasePath(pathname: string, basePath: string): string {
  if (basePath === '/') return pathname || '/'
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  if (normalizedPath === '/') return basePath.slice(0, -1) || '/'
  return `${basePath.slice(0, -1)}${normalizedPath}`
}

/**
 * The browser's configured base path, read without importing `static-mode`.
 *
 * Client navigation only ever runs in a document, where `getBasePath()` itself resolves to this
 * same global (`ssrBasePath` is only set while prerendering, where no click can happen). Keeping
 * the read local means a test that partially mocks `static-mode` cannot break link navigation.
 */
export function currentBrowserBasePath(): string {
  if (typeof window === 'undefined') return '/'
  const configured = (window as { __OPENSPEC_BASE_PATH__?: unknown }).__OPENSPEC_BASE_PATH__
  return typeof configured === 'string' && configured.length > 0
    ? normalizeBasePath(configured)
    : '/'
}

/**
 * Project a resolved href onto a base-relative path.
 *
 * A rendered `<a href>` already carries the router's base path, and `router.navigate()` applies
 * the base path again — so the resolved value has to be stripped first.
 */
export function toBaseRelativeHref(href: string, basePath = currentBrowserBasePath()): string {
  if (typeof window === 'undefined') return href
  const url = new URL(href, window.location.origin)
  url.pathname = stripBasePath(url.pathname, normalizeBasePath(basePath))
  return `${url.pathname}${url.search}${url.hash}`
}
