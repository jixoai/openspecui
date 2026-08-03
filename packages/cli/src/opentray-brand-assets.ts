/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Project the hand-designed platform-native App identity variant catalog into OpenTray AppIcon.
 * 2. Project one compact transparent logo into platform-specific tray icon candidates.
 *
 * Owner request (2026-07-30): "logo要全面应用：titlebar中、appIcon中、trayIcon中。"
 * Original request (2026-08-02): "我手动设计了 ./app-icon，请将它配置(复制)到 native-icons 中，
 *   参考 ../skill-creator-v2 的配置。Windows 平台使用 light 风格"
 * Asset layout (mirrors skill-creator-v2/resources/app-icon): light assets declare
 * variant ['default','light'], dark assets declare variant 'dark'. Windows uses light.
 */
import { join } from 'node:path'
import type { AppIcon, Icon } from 'opentray'

export interface OpenTrayBrandAssets {
  appIcon: AppIcon | null
  trayIcon: Icon
}

/** Resolve brand assets from the same App tree served and packaged by the CLI. */
export function resolveOpenTrayBrandAssets(
  appAssetsDir: string,
  platform: NodeJS.Platform
): OpenTrayBrandAssets {
  const trayIconPath = join(appAssetsDir, 'native-icons', 'tray-icon.png')
  const trayIcon: Icon = {
    'darwin-icon-only': { type: 'file', path: trayIconPath, isTemplate: true },
    'win32-icon-only': { type: 'file', path: trayIconPath },
    'linux-icon-only': { type: 'file', path: trayIconPath },
  }

  if (platform === 'darwin') {
    return {
      trayIcon,
      appIcon: [
        {
          platform: 'darwin',
          format: 'icns',
          variant: ['default', 'light'],
          source: {
            type: 'file',
            path: join(appAssetsDir, 'native-icons', 'app-icon', 'darwin-light.icns'),
          },
        },
        {
          platform: 'darwin',
          format: 'icns',
          variant: 'dark',
          source: {
            type: 'file',
            path: join(appAssetsDir, 'native-icons', 'app-icon', 'darwin-dark.icns'),
          },
        },
      ],
    }
  }
  if (platform === 'win32') {
    return {
      trayIcon,
      appIcon: [
        {
          platform: 'windows',
          format: 'ico',
          variant: ['default', 'light'],
          source: {
            type: 'file',
            path: join(appAssetsDir, 'native-icons', 'app-icon', 'win32-light.ico'),
          },
        },
        {
          platform: 'windows',
          format: 'ico',
          variant: 'dark',
          source: {
            type: 'file',
            path: join(appAssetsDir, 'native-icons', 'app-icon', 'win32-dark.ico'),
          },
        },
      ],
    }
  }
  if (platform === 'linux') {
    return {
      trayIcon,
      appIcon: [
        {
          platform: 'linux',
          format: 'png',
          size: 512,
          source: {
            type: 'file',
            path: join(
              appAssetsDir,
              'native-icons',
              'app-icon',
              'linux',
              '512x512',
              'app-icon.png'
            ),
          },
        },
      ],
    }
  }
  return { appIcon: null, trayIcon }
}
