/**
 * Orthogonal intents (created 2026-07-18 Asia/Shanghai):
 * 1. Share type-safe Environment Global JSON guards between projection and profile controls.
 * 2. Normalize CLI workflow lists without inventing unsupported profile state.
 *
 * Original request (2026-07-18): "Environment Global profile/drift must come from one reactive projection."
 */
import type { CliJsonValue } from '@openspecui/core'

/** Return true for JSON objects used as editable OpenSpec config documents. */
export function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Validate one recursively nested CLI JSON value. */
export function isCliJsonValue(value: unknown): value is CliJsonValue {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return true
  if (Array.isArray(value)) return value.every(isCliJsonValue)
  return isRecordObject(value) && Object.values(value).every(isCliJsonValue)
}

/** Validate an editable CLI JSON object. */
export function isCliJsonObject(value: unknown): value is Record<string, CliJsonValue> {
  return isRecordObject(value) && Object.values(value).every(isCliJsonValue)
}

/** Keep only non-empty workflow identifiers from an upstream JSON projection. */
export function normalizeWorkflowList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : []
}
