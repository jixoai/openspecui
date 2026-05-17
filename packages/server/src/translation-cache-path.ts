import { homedir, platform } from 'node:os'
import { join } from 'node:path'

export function getDefaultTranslationCacheDatabasePath(): string {
  return join(getOpenSpecUICacheDir(), 'translation-cache.sqlite')
}

export function getOpenSpecUICacheDir(): string {
  const currentPlatform = platform()

  if (currentPlatform === 'darwin') {
    return join(homedir(), 'Library', 'Caches', 'openspecui')
  }

  if (currentPlatform === 'win32') {
    return join(
      process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
      'OpenSpecUI',
      'Cache'
    )
  }

  return join(process.env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'openspecui')
}
