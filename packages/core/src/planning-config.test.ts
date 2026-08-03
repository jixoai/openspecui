/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Lock neutral Project Binding inspection for valid and malformed declarations.
 * 2. Prove binding updates preserve unrelated OpenSpec configuration and comments.
 * 3. Classify machine `defaultStore` without inventing registry or effective-root truth.
 *
 * Original request (2026-07-15): "Project Binding edits store and references without becoming an ambiguous YAML editor."
 */
import { describe, expect, it } from 'vitest'
import {
  inspectEnvironmentDefaultStore,
  inspectProjectBinding,
  updateProjectBindingContent,
} from './planning-config.js'

describe('Environment default Store config', () => {
  it('distinguishes absent, configured, and invalid authored values', () => {
    expect(inspectEnvironmentDefaultStore({ profile: 'core' })).toEqual({
      state: 'absent',
      id: null,
    })
    expect(inspectEnvironmentDefaultStore({ defaultStore: 'team-plans' })).toEqual({
      state: 'configured',
      id: 'team-plans',
    })
    expect(inspectEnvironmentDefaultStore({ defaultStore: 42 })).toEqual({
      state: 'invalid',
      id: null,
      value: 42,
    })
    expect(inspectEnvironmentDefaultStore({ defaultStore: '' })).toEqual({
      state: 'invalid',
      id: null,
      value: '',
    })
  })
})

describe('Project Binding config', () => {
  it('keeps authored Store and Reference declarations distinct from effective Root Context', () => {
    expect(
      inspectProjectBinding(`
schema: spec-driven
store: shared
references:
  - platform
  - id: design-system
    remote: https://example.test/design-system.git
`)
    ).toEqual({
      store: { state: 'declared', id: 'shared' },
      references: {
        state: 'declared',
        entries: [
          { id: 'platform' },
          { id: 'design-system', remote: 'https://example.test/design-system.git' },
        ],
      },
      diagnostics: [],
    })
  })

  it('reports malformed declarations without fabricating effective values', () => {
    expect(
      inspectProjectBinding(`
store:
  - shared
references:
  - id: valid
  - id: broken
    remote: 42
  - false
`)
    ).toEqual({
      store: { state: 'invalid', id: null },
      references: { state: 'invalid', entries: [{ id: 'valid' }] },
      diagnostics: [
        expect.objectContaining({ code: 'store-not-string' }),
        expect.objectContaining({ code: 'reference-entry-invalid' }),
      ],
    })
  })

  it('updates only binding fields and preserves comments, schema, context, and rules', () => {
    const updated = updateProjectBindingContent(
      `# planning policy
schema: custom
context: keep me
rules:
  proposal:
    - keep this rule
store: old
references:
  - old-reference
`,
      {
        store: 'shared',
        references: [
          { id: 'platform' },
          { id: 'design-system', remote: 'https://example.test/design-system.git' },
        ],
      }
    )

    expect(updated).toContain('# planning policy')
    expect(updated).toContain('schema: custom')
    expect(updated).toContain('context: keep me')
    expect(updated).toContain('keep this rule')
    expect(inspectProjectBinding(updated)).toMatchObject({
      store: { state: 'declared', id: 'shared' },
      references: {
        state: 'declared',
        entries: [
          { id: 'platform' },
          { id: 'design-system', remote: 'https://example.test/design-system.git' },
        ],
      },
    })
  })

  it('removes binding fields without deleting active-root configuration', () => {
    const updated = updateProjectBindingContent(
      'schema: spec-driven\nstore: shared\nreferences: [platform]\n',
      { store: null, references: null }
    )

    expect(updated).toContain('schema: spec-driven')
    expect(updated).not.toContain('store:')
    expect(updated).not.toContain('references:')
  })

  it('never treats machine defaultStore as the project store declaration', () => {
    const source = 'schema: spec-driven\ndefaultStore: machine-fallback\n'

    expect(inspectProjectBinding(source).store).toEqual({ state: 'absent', id: null })
    const updated = updateProjectBindingContent(source, { store: 'project-store' })
    expect(updated).toContain('defaultStore: machine-fallback')
    expect(inspectProjectBinding(updated).store).toEqual({
      state: 'declared',
      id: 'project-store',
    })
  })
})
