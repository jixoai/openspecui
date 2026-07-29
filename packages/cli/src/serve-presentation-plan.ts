/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Decide serve presentation without performing process, IPC, prompt, or browser side effects.
 * 2. Preserve daemon-present attachment and non-interactive Direct Web behavior.
 *
 * Original request (2026-07-29): "如果发现没有 app daemon，会询问 [Y/n]；如果已经有 daemon，默认投递到 app。"
 */

export type ServePresentationPlan =
  | { kind: 'none' }
  | { kind: 'prompt-for-app' }
  | { kind: 'direct-web' }
  | { kind: 'app'; startDaemon: boolean }
  | { kind: 'app-and-direct-web' }

export interface ServePresentationInput {
  open: boolean
  app: boolean
  web: boolean
  daemonRunning: boolean
  interactive: boolean
}

/** Resolve the objective presentation effects for a ready project backend. */
export function planServePresentation(input: ServePresentationInput): ServePresentationPlan {
  if (!input.open) return { kind: 'none' }
  if (input.app) return { kind: 'app', startDaemon: !input.daemonRunning }
  if (input.web) {
    return input.daemonRunning ? { kind: 'app-and-direct-web' } : { kind: 'direct-web' }
  }
  if (input.daemonRunning) return { kind: 'app', startDaemon: false }
  if (input.interactive) return { kind: 'prompt-for-app' }
  return { kind: 'direct-web' }
}

/** Resolve the interactive `[Y/n]` answer after admission has been requested. */
export function resolveAppPrompt(accepted: boolean): ServePresentationPlan {
  return accepted ? { kind: 'app', startDaemon: true } : { kind: 'direct-web' }
}
