/**
 * Orthogonal intents (created 2026-09-12 Asia/Shanghai):
 * 1. Derive one shared display title for a Change across list, dashboard, and detail surfaces.
 * 2. Treat the proposal H1 as a human-readable title only when it is informative.
 * 3. Fall back to the change id (the CLI's own canonical name) otherwise.
 *
 * Original request (2026-09-12): Owner walkthrough: the Changes list showed the generic proposal
 *   heading "Proposal" as the row title while Change Detail showed the change id — unify the scheme.
 */

/**
 * Heading texts that carry no identity information. `openspec new change` scaffolds proposals with
 * the bare heading "# Proposal"; showing it as a row title reads as a parsing bug rather than a name.
 */
const GENERIC_PROPOSAL_HEADINGS = new Set(['proposal'])

/**
 * One display title for a Change, identical on every surface.
 *
 * `name` is the legacy parser's proposal H1 (absent for parser-less custom schemas); the change id
 * is the CLI-owned canonical identity (`openspec list --json` names changes by directory). The H1
 * wins only when it is a real, differentiated title; generic headings and the id itself fall back
 * to the id, so no surface ever shows two different titles for the same Change.
 */
export function changeDisplayTitle(changeId: string, name?: string | null): string {
  const trimmed = name?.trim()
  if (!trimmed || trimmed === changeId) return changeId
  if (GENERIC_PROPOSAL_HEADINGS.has(trimmed.toLowerCase())) return changeId
  return trimmed
}
