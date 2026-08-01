/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Decide serve presentation without performing process, IPC, prompt, or browser side effects.
 * 2. Preserve daemon-present attachment, explicit flags, and the global-mode preference fallback.
 * 3. Flag an implicit non-interactive Direct Web default so the execution owner can warn.
 *
 * Original request (2026-07-29): "如果发现没有 app daemon，会询问 [Y/n]；如果已经有 daemon，默认投递到 app。"
 * Original request (2026-08-01): "全局存储用户偏好；交互式 Radio；非 tty 无偏好默认 web + 警告。"
 */

/** The two user-selectable serve presentation modes. */
export type ServeMode = 'app' | 'web'

export type ServePresentationPlan =
  | { kind: 'none' }
  | { kind: 'prompt-for-mode' }
  | { kind: 'direct-web'; warnImplicitDefault?: boolean }
  | { kind: 'app'; startDaemon: boolean }
  | { kind: 'app-and-direct-web' }

export interface ServePresentationInput {
  open: boolean
  app: boolean
  web: boolean
  daemonRunning: boolean
  interactive: boolean
  /** Remembered global preference; `undefined` means no preference has been set yet. */
  preference: ServeMode | undefined
}

/**
 * Warning shown when a non-interactive session falls back to Direct Web because no
 * global serve preference has been recorded. Kept here so the pure plan owns the
 * exact message and tests can assert against it.
 */
export const IMPLICIT_DEFAULT_WARNING =
  'No default serve mode is set; opening Direct Web this time. Pass --app or --web, or run once interactively to remember a default.'

/** Resolve the objective presentation effects for a ready project backend. */
export function planServePresentation(input: ServePresentationInput): ServePresentationPlan {
  if (!input.open) return { kind: 'none' }
  if (input.app) return { kind: 'app', startDaemon: !input.daemonRunning }
  if (input.web) {
    return input.daemonRunning ? { kind: 'app-and-direct-web' } : { kind: 'direct-web' }
  }
  if (input.daemonRunning) return { kind: 'app', startDaemon: false }
  if (input.interactive) return { kind: 'prompt-for-mode' }
  if (input.preference === 'app') return { kind: 'app', startDaemon: true }
  if (input.preference === 'web') return { kind: 'direct-web' }
  return { kind: 'direct-web', warnImplicitDefault: true }
}

/** Resolve the interactive Radio selection after a mode has been requested. */
export function resolveModePrompt(mode: ServeMode): ServePresentationPlan {
  return mode === 'app' ? { kind: 'app', startDaemon: true } : { kind: 'direct-web' }
}
