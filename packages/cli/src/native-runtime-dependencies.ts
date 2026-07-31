/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Keep native/runtime facades external to the CLI bundle so installed package closure remains authoritative.
 * 2. Distinguish install-time native bindings from runtimes installed only on user demand.
 *
 * Original request (2026-07-29): "OpenTray packages lock to one exact compatible protocol line."
 * Original request (2026-07-31): "这个依赖好像会导致安装的时候仍然会被强制装上去，可能要改成 peerDependencies 会更好"
 */
export const CLI_OPTIONAL_NATIVE_RUNTIME_PEER_DEPENDENCIES = [
  'ctranslate2',
  'node-llama-cpp',
] as const

export const CLI_NATIVE_RUNTIME_DEPENDENCIES = [
  'opentray',
  '@opentray/ext-webview',
  '@parcel/watcher',
  '@lydell/node-pty',
  'better-sqlite3',
  ...CLI_OPTIONAL_NATIVE_RUNTIME_PEER_DEPENDENCIES,
] as const
