/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Verify official projection round-trips into distinct rule and operation form fields.
 * 2. Verify empty, duplicate, and byte-limit intermediate values cannot cross mutation transport.
 *
 * Original request (2026-08-01): Active Root Structured mode aligns exactly with OpenSpec 1.7 official fields.
 */
import { describe, expect, it } from 'vitest'
import {
  createActiveRootStructuredDraft,
  normalizeActiveRootStructuredDraft,
} from './active-root-structured-draft'

describe('Active Root Structured draft', () => {
  it('keeps artifact rules separate from apply and archive guidance', () => {
    const draft = createActiveRootStructuredDraft({
      schema: 'spec-driven',
      context: 'Team context',
      rules: { proposal: ['Rule one', 'Rule two'] },
      operations: {
        apply: { guidance: ['Apply one'] },
        archive: { guidance: ['Archive one'] },
      },
    })

    expect(draft).toEqual({
      schema: 'spec-driven',
      context: 'Team context',
      rules: [
        {
          id: 'source:proposal',
          artifactId: 'proposal',
          guidance: 'Rule one\nRule two',
        },
      ],
      applyGuidance: 'Apply one',
      archiveGuidance: 'Archive one',
    })
    expect(normalizeActiveRootStructuredDraft(draft)).toEqual({
      valid: true,
      errors: [],
      update: {
        schema: 'spec-driven',
        context: 'Team context',
        rules: { proposal: ['Rule one', 'Rule two'] },
        operations: {
          apply: { guidance: ['Apply one'] },
          archive: { guidance: ['Archive one'] },
        },
      },
    })
  })

  it('rejects invalid form intermediates and omits empty optional official fields', () => {
    expect(
      normalizeActiveRootStructuredDraft({
        schema: ' ',
        context: 'x'.repeat(50 * 1024 + 1),
        rules: [
          { id: 'one', artifactId: 'proposal', guidance: 'Rule' },
          { id: 'two', artifactId: 'proposal', guidance: 'Other' },
          { id: 'three', artifactId: '', guidance: '' },
        ],
        applyGuidance: '',
        archiveGuidance: '',
      })
    ).toMatchObject({
      valid: false,
      errors: [
        'Schema is required.',
        expect.stringContaining('UTF-8 bytes'),
        "Artifact rule 'proposal' is duplicated.",
        'Every rule group requires an artifact id.',
      ],
    })

    expect(
      normalizeActiveRootStructuredDraft({
        schema: 'spec-driven',
        context: '',
        rules: [],
        applyGuidance: '',
        archiveGuidance: '',
      })
    ).toEqual({
      valid: true,
      errors: [],
      update: {
        schema: 'spec-driven',
        context: null,
        rules: null,
        operations: null,
      },
    })
  })
})
