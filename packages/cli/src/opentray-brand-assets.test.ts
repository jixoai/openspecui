/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Prove each platform receives its hand-designed default/light plus dark App identity variants.
 * 2. Prove tray candidates share one bundled logo and macOS declares template behavior.
 *
 * Owner request (2026-07-30): "logo要全面应用：titlebar中、appIcon中、trayIcon中。"
 * Original request (2026-08-02): hand-designed app-icon catalog with light/dark variants;
 *   Windows uses light. Mirrors skill-creator-v2/resources/app-icon asset layout.
 */
import { describe, expect, it } from 'vitest'
import { resolveOpenTrayBrandAssets } from './opentray-brand-assets.js'

describe('OpenTray brand assets', () => {
  it('projects Darwin default/light and dark icns variants', () => {
    const brand = resolveOpenTrayBrandAssets('/package/app', 'darwin')

    expect(brand.appIcon).toEqual([
      expect.objectContaining({
        platform: 'darwin',
        format: 'icns',
        variant: ['default', 'light'],
        source: { type: 'file', path: '/package/app/native-icons/app-icon/darwin-light.icns' },
      }),
      expect.objectContaining({
        platform: 'darwin',
        format: 'icns',
        variant: 'dark',
        source: { type: 'file', path: '/package/app/native-icons/app-icon/darwin-dark.icns' },
      }),
    ])
    expect(brand.trayIcon).toEqual({
      'darwin-icon-only': {
        type: 'file',
        path: '/package/app/native-icons/tray-icon.png',
        isTemplate: true,
      },
      'win32-icon-only': {
        type: 'file',
        path: '/package/app/native-icons/tray-icon.png',
      },
      'linux-icon-only': {
        type: 'file',
        path: '/package/app/native-icons/tray-icon.png',
      },
    })
  })

  it('projects Windows default/light and dark ico variants', () => {
    const brand = resolveOpenTrayBrandAssets('/package/app', 'win32')

    expect(brand.appIcon).toEqual([
      expect.objectContaining({
        platform: 'windows',
        format: 'ico',
        variant: ['default', 'light'],
        source: { type: 'file', path: '/package/app/native-icons/app-icon/win32-light.ico' },
      }),
      expect.objectContaining({
        platform: 'windows',
        format: 'ico',
        variant: 'dark',
        source: { type: 'file', path: '/package/app/native-icons/app-icon/win32-dark.ico' },
      }),
    ])
  })

  it('projects the Linux default png variant', () => {
    const brand = resolveOpenTrayBrandAssets('/package/app', 'linux')

    expect(brand.appIcon).toEqual([
      expect.objectContaining({
        platform: 'linux',
        format: 'png',
        size: 512,
        source: {
          type: 'file',
          path: '/package/app/native-icons/app-icon/linux/512x512/app-icon.png',
        },
      }),
    ])
  })
})
