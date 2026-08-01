/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Define the serve-preference port consumed by CLI execution (read/write the mode).
 * 2. Adapt GlobalSettingsManager into that port without leaking the full settings surface.
 *
 * Original request (2026-08-01): "全局存储用户偏好。"
 */
import type { GlobalSettingsManager, ServePresentationMode } from '@openspecui/core'
import type { ServeMode } from './serve-presentation-plan.js'

/** Read/write the remembered serve presentation mode for the current user. */
export interface ServePreferencesPort {
  read(): Promise<ServeMode | undefined>
  write(mode: ServeMode): Promise<void>
}

function isServeMode(value: ServePresentationMode | undefined): value is ServeMode {
  return value === 'app' || value === 'web'
}

/** Adapt the user-global settings manager into the narrow serve-preference port. */
export function createServePreferencesPort(manager: GlobalSettingsManager): ServePreferencesPort {
  return {
    async read() {
      const settings = await manager.readSettings()
      return isServeMode(settings.servePresentation) ? settings.servePresentation : undefined
    },
    async write(mode) {
      await manager.writeSettings({ servePresentation: mode })
    },
  }
}
