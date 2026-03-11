export interface HostedAppPwaManifestIcon {
  src: string
  sizes: string
  type: 'image/png'
  purpose?: 'any' | 'maskable' | 'any maskable'
}

export interface HostedAppPwaManifest {
  id: '/'
  name: 'OpenSpec UI App'
  short_name: 'OpenSpecUI'
  description: string
  start_url: '/'
  scope: '/'
  display: 'standalone'
  display_override: readonly ['window-controls-overlay', 'standalone']
  background_color: string
  theme_color: string
  icons: readonly HostedAppPwaManifestIcon[]
  launch_handler: {
    client_mode: 'focus-existing'
  }
}

export function createHostedAppPwaManifest(): HostedAppPwaManifest {
  return {
    id: '/',
    name: 'OpenSpec UI App',
    short_name: 'OpenSpecUI',
    description: 'Hosted multi-tab OpenSpec UI shell with installable PWA support.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#121212',
    theme_color: '#121212',
    icons: [
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
    ],
    launch_handler: {
      client_mode: 'focus-existing',
    },
  }
}
