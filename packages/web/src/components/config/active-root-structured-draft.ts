/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Convert resilient official Active Root projection into editable form state.
 * 2. Validate and normalize human multiline form input into the strict Core mutation contract.
 *
 * Original request (2026-08-01): Active Root Structured mode edits official fields without replacing team YAML.
 * Derived checkpoint (2026-08-02): artifact rules and operation guidance remain distinct typed facts.
 */
import type { ActiveRootOfficialConfig, ActiveRootStructuredUpdate } from '@openspecui/core'
import { MAX_ACTIVE_ROOT_CONTEXT_BYTES } from '@openspecui/core/active-root-config'

/** One stable editable artifact-rule group. */
export interface ActiveRootRuleDraft {
  id: string
  artifactId: string
  guidance: string
}

/** Form-native Structured-mode draft with multiline list fields. */
export interface ActiveRootStructuredDraft {
  schema: string
  context: string
  rules: ActiveRootRuleDraft[]
  applyGuidance: string
  archiveGuidance: string
}

/** Structured draft normalization outcome used to lock invalid saves before transport. */
export type ActiveRootStructuredDraftResult =
  | { valid: true; update: ActiveRootStructuredUpdate; errors: [] }
  | { valid: false; update: null; errors: string[] }

function joinLines(entries: readonly string[] | undefined): string {
  return entries?.join('\n') ?? ''
}

function normalizedLines(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}

/** Build one mode-local form draft from the latest official projection. */
export function createActiveRootStructuredDraft(
  official: ActiveRootOfficialConfig
): ActiveRootStructuredDraft {
  return {
    schema: official.schema ?? 'spec-driven',
    context: official.context ?? '',
    rules: Object.entries(official.rules ?? {}).map(([artifactId, entries]) => ({
      id: `source:${artifactId}`,
      artifactId,
      guidance: joinLines(entries),
    })),
    applyGuidance: joinLines(official.operations?.apply?.guidance),
    archiveGuidance: joinLines(official.operations?.archive?.guidance),
  }
}

/** Validate editable intermediate state and normalize it into one complete Structured update. */
export function normalizeActiveRootStructuredDraft(
  draft: ActiveRootStructuredDraft
): ActiveRootStructuredDraftResult {
  const errors: string[] = []
  const schema = draft.schema.trim()
  if (schema.length === 0) errors.push('Schema is required.')
  if (new TextEncoder().encode(draft.context).byteLength > MAX_ACTIVE_ROOT_CONTEXT_BYTES) {
    errors.push(`Context must not exceed ${MAX_ACTIVE_ROOT_CONTEXT_BYTES} UTF-8 bytes.`)
  }

  const rules: Record<string, string[]> = {}
  for (const rule of draft.rules) {
    const artifactId = rule.artifactId.trim()
    const guidance = normalizedLines(rule.guidance)
    if (artifactId.length === 0) {
      errors.push('Every rule group requires an artifact id.')
      continue
    }
    if (Object.hasOwn(rules, artifactId)) {
      errors.push(`Artifact rule '${artifactId}' is duplicated.`)
      continue
    }
    if (guidance.length === 0) {
      errors.push(`Artifact rule '${artifactId}' requires at least one rule.`)
      continue
    }
    rules[artifactId] = guidance
  }

  if (errors.length > 0) return { valid: false, update: null, errors }
  const applyGuidance = normalizedLines(draft.applyGuidance)
  const archiveGuidance = normalizedLines(draft.archiveGuidance)
  return {
    valid: true,
    errors: [],
    update: {
      schema,
      context: draft.context.length > 0 ? draft.context : null,
      rules: Object.keys(rules).length > 0 ? rules : null,
      operations:
        applyGuidance.length > 0 || archiveGuidance.length > 0
          ? {
              apply: applyGuidance.length > 0 ? { guidance: applyGuidance } : null,
              archive: archiveGuidance.length > 0 ? { guidance: archiveGuidance } : null,
            }
          : null,
    },
  }
}
