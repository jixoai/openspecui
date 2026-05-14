import { getBasePath } from '../static-mode'

export function resolveNotificationIconUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  const basePath = getBasePath()
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`
  return new URL(`${normalizedBase}icon.rounded.svg`, window.location.href).href
}
