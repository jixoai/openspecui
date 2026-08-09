/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Bound Windows Web-unit worker pressure while preserving existing non-Windows concurrency.
 *
 * Original request (2026-08-09): "Continue the Windows adaptation and handle similar issues together."
 */
import { availableParallelism } from 'node:os'

/** Resolve the unit-test worker owner without inflating individual test timeouts. */
export function resolveWebUnitMaxWorkers(
  platform: NodeJS.Platform = process.platform,
  parallelism: number = availableParallelism()
): number | string {
  if (platform !== 'win32') return '50%'
  return Math.max(1, Math.min(4, parallelism))
}
