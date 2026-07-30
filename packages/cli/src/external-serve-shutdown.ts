/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Describe the optional owner-handled shutdown capability an external foreground serve lease MAY advertise (3.0e).
 * 2. Keep external process ownership physically distinct: the daemon never infers or signals a process.
 *
 * Original request (2026-07-30): "关键是，支持直接从目录直接启动 openspecui 服务。"
 * Owner lifecycle decision (2026-07-30): an external backend exposes Stop only when its exact
 *   current serve lease advertises owner-handled shutdown; otherwise Task Manager exposes Close only.
 * Spec: cli-commands › "Stop an external foreground project".
 *
 * This is the capability contract only. When the capability is absent, the only valid Task Manager
 * action for an external backend is presentation Close; the daemon must never kill, signal, or adopt
 * the foreground process by path/port/PID inference.
 */

/** Outcome of asking an external serve owner to handle its own shutdown. */
export type ExternalServeShutdownResult =
  | { ok: true }
  | { ok: false; code: 'unsupported' | 'unavailable' | 'failed'; message: string }

/**
 * Optional owner-handled shutdown capability an external foreground `serve` lease MAY advertise.
 *
 * `isAvailable()` reports whether the current lease can fulfill a shutdown request; `request()` asks
 * the owning foreground process to perform and settle its own Server teardown. The daemon delegates
 * shutdown entirely to the owner and never signals the process itself.
 */
export interface ExternalServeShutdownCapability {
  isAvailable(): boolean
  request(): Promise<ExternalServeShutdownResult>
}

/** A capability that never advertises shutdown; use when a lease omits owner-handled shutdown. */
export const unsupportedExternalServeShutdown: ExternalServeShutdownCapability = {
  isAvailable: () => false,
  async request() {
    return {
      ok: false,
      code: 'unsupported',
      message: 'This backend does not advertise owner-handled shutdown.',
    }
  },
}

/**
 * Resolve the Task Manager command for one external backend.
 *
 * - When the exact current lease advertises shutdown, Stop delegates to `request()`.
 * - Without the capability, only presentation Close is valid; Stop is not offered and never inferred.
 */
export type ExternalServeTaskCommand =
  | { kind: 'stop'; capability: ExternalServeShutdownCapability }
  | { kind: 'close-only' }

export function resolveExternalServeTaskCommand(
  capability: ExternalServeShutdownCapability | null | undefined
): ExternalServeTaskCommand {
  if (capability && capability.isAvailable()) {
    return { kind: 'stop', capability }
  }
  return { kind: 'close-only' }
}
