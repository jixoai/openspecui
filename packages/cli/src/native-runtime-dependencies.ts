/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Keep native/runtime facades external to the CLI bundle so installed package closure remains authoritative.
 *
 * Original request (2026-07-29): "OpenTray packages lock to one exact compatible protocol line."
 */
export const CLI_NATIVE_RUNTIME_DEPENDENCIES = [
  'opentray',
  '@opentray/ext-webview',
  'ctranslate2',
  'node-llama-cpp',
  '@parcel/watcher',
  '@lydell/node-pty',
  'better-sqlite3',
] as const
