import { describe, expect, it } from 'vitest'
import { createHostedAppPwaManifest } from './pwa-manifest'

describe('hosted app pwa manifest', () => {
  it('creates an installable standalone manifest with launch handling', () => {
    const manifest = createHostedAppPwaManifest()

    expect(manifest.id).toBe('/')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.display).toBe('standalone')
    expect(manifest.display_override).toEqual(['window-controls-overlay', 'standalone'])
    expect(manifest.launch_handler).toEqual({ client_mode: 'focus-existing' })
    expect(manifest.icons).toEqual([
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ])
  })
})
