/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Resolve the stable cross-platform host fact used to issue hosted environment identity.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { hostname } from 'node:os'

/** Injectable provider for the backend host component of environment identity. */
export type ServerHostIdentityProvider = () => string

/** Resolve the default host identity without project, port, PID, or process-lifetime inputs. */
export function resolveDefaultServerHostIdentity(): string {
  const value = hostname().trim().toLowerCase()
  if (!value) throw new Error('Unable to resolve a stable backend host identity.')
  return `hostname:${value}`
}
