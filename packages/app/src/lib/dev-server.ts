import type { HostedAppVersionManifest } from '@openspecui/core/hosted-app'
import { extname } from 'node:path'
import { createHostedAppManifest } from './manifest'

export const LOCAL_DEV_CHANNEL_ID = 'latest'

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

export function createLocalDevManifest(resolvedVersion: string): HostedAppVersionManifest {
  return createHostedAppManifest({
    generatedAt: new Date().toISOString(),
    channels: [
      {
        id: LOCAL_DEV_CHANNEL_ID,
        kind: 'latest',
        selector: 'latest',
        resolvedVersion,
        major: 0,
      },
    ],
  })
}

function hasFileExtension(pathname: string): boolean {
  const segment = pathname.split('/').pop() ?? ''
  return segment.includes('.')
}

export function resolveLocalDevBundleRelativePath(pathname: string): string | null {
  const prefix = `/versions/${LOCAL_DEV_CHANNEL_ID}/`
  if (pathname === `/versions/${LOCAL_DEV_CHANNEL_ID}` || pathname === prefix) {
    return 'index.html'
  }
  if (!pathname.startsWith(prefix)) {
    return null
  }

  const relative = pathname.slice(prefix.length)
  if (relative.length === 0) {
    return 'index.html'
  }

  if (!hasFileExtension(relative)) {
    return 'index.html'
  }

  return relative
}

export function getMimeType(pathname: string): string {
  return MIME_TYPES[extname(pathname)] ?? 'application/octet-stream'
}
