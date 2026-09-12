/**
 * Orthogonal intents (created 2026-09-12 Asia/Shanghai):
 * 1. Pin the shared Change display-title derivation used by list, dashboard, and detail.
 * 2. Generic scaffold headings ("# Proposal") fall back to the change id.
 * 3. Informative proposal headings win; absent/parser-less rows fall back to the id.
 *
 * Original request (2026-09-12): Owner walkthrough: unify the Change title across surfaces —
 *   the list showed the generic "Proposal" heading while the detail showed the change id.
 */
import { describe, expect, it } from 'vitest'
import { changeDisplayTitle } from './change-display-title'

describe('changeDisplayTitle', () => {
  it('prefers an informative proposal heading', () => {
    expect(changeDisplayTitle('add-search', 'Add Search')).toBe('Add Search')
  })

  it('falls back to the change id for the generic scaffold heading', () => {
    expect(changeDisplayTitle('no-specs-but-tasks', 'Proposal')).toBe('no-specs-but-tasks')
    // Case-insensitive: the scaffold heading is a structural marker, not a name.
    expect(changeDisplayTitle('a', 'proposal')).toBe('a')
  })

  it('falls back to the change id when the heading equals the id, is blank, or is absent', () => {
    expect(changeDisplayTitle('add-search', 'add-search')).toBe('add-search')
    expect(changeDisplayTitle('add-search', '   ')).toBe('add-search')
    expect(changeDisplayTitle('add-search', null)).toBe('add-search')
    expect(changeDisplayTitle('add-search', undefined)).toBe('add-search')
  })

  it('trims a real heading before use', () => {
    expect(changeDisplayTitle('a', '  Add Search  ')).toBe('Add Search')
  })
})
