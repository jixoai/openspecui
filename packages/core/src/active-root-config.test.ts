/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Verify resilient OpenSpec 1.7 official-field projection without claiming team-key ownership.
 * 2. Verify structured YAML patching preserves comments, ordering, bindings, and nested unknown nodes.
 * 3. Verify explicit field clearing and invalid-source recovery boundaries.
 * 4. Verify typed structured/raw mutation admission contracts.
 *
 * Original request (2026-08-01): structured editing follows the official standard while raw YAML preserves team extensions.
 * Derived checkpoint (2026-08-02): Active Root owns schema, context, rules, and apply/archive guidance only.
 */
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ActiveRootMutationSchema,
  inspectActiveRootOfficialConfig,
  patchActiveRootOfficialFields,
  validateActiveRootRawYaml,
} from './active-root-config.js'

const fixturePath = fileURLToPath(
  new URL('../../../test-fixtures/openspec-1.7-active-root-config.yaml', import.meta.url)
)

describe('Active Root official config projection', () => {
  it('projects 1.7 fields while accepting team-defined keys without diagnostics', async () => {
    const content = await readFile(fixturePath, 'utf8')

    expect(inspectActiveRootOfficialConfig(content)).toEqual({
      official: {
        schema: 'spec-driven',
        context: 'Payments platform maintained by Team Atlas.\nPrefer reversible migrations.',
        rules: {
          proposal: ['State the rollback boundary.'],
          tasks: ['Keep each task independently verifiable.'],
        },
        operations: {
          apply: { guidance: ['Run focused checks before broad gates.'] },
          archive: { guidance: ['Preserve release evidence.'] },
        },
      },
      diagnostics: [],
    })
  })

  it('keeps valid sibling fields while reporting malformed official values', () => {
    const projection = inspectActiveRootOfficialConfig(`
schema: ''
context: [not, text]
rules:
  proposal: wrong
  tasks: [Keep this, '', 7]
operations:
  apply:
    guidance: wrong
  archive:
    guidance: [Keep this, '']
x-company: accepted
`)

    expect(projection.official).toEqual({
      schema: null,
      context: null,
      rules: null,
      operations: { archive: { guidance: ['Keep this'] } },
    })
    expect(projection.diagnostics.map(({ code }) => code)).toEqual([
      'schema-invalid',
      'context-invalid',
      'rules-entry-invalid',
      'rules-entry-invalid',
      'operation-guidance-invalid',
      'operation-guidance-empty',
    ])
  })
})

describe('Active Root structured YAML patching', () => {
  it('patches owned nodes while preserving comments, ordering, bindings, and nested extensions', async () => {
    const content = await readFile(fixturePath, 'utf8')

    const updated = patchActiveRootOfficialFields(content, {
      schema: 'team-workflow',
      context: 'Updated through structured fields.\nSecond line.',
      rules: {
        proposal: ['Add rollout evidence.'],
        design: ['Keep architecture decisions explicit.'],
      },
      operations: {
        apply: { guidance: ['Run the focused suite.'] },
        archive: null,
      },
    })

    expect(updated).toContain('schema: team-workflow # Keep the selected workflow comment.')
    expect(updated).toContain('# This rule comment must survive a structured save.')
    expect(updated).toContain('store: shared-platform')
    expect(updated).toContain('references:')
    expect(updated).toContain('x-team-policy:')
    expect(updated).toContain('x-review-owner: atlas')
    expect(updated).toContain('deploy:')
    expect(updated).toContain('x-audit:')
    expect(updated).not.toContain('Preserve release evidence.')
    expect(updated).not.toContain('  tasks:')
    expect(updated.indexOf('store:')).toBeLessThan(updated.indexOf('schema:'))
    expect(updated.indexOf('schema:')).toBeLessThan(updated.indexOf('x-team-policy:'))
    expect(inspectActiveRootOfficialConfig(updated).official).toEqual({
      schema: 'team-workflow',
      context: 'Updated through structured fields.\nSecond line.',
      rules: {
        proposal: ['Add rollout evidence.'],
        design: ['Keep architecture decisions explicit.'],
      },
      operations: { apply: { guidance: ['Run the focused suite.'] } },
    })
  })

  it('clears only owned optional nodes and routes an invalid source to raw recovery', async () => {
    const content = await readFile(fixturePath, 'utf8')
    const updated = patchActiveRootOfficialFields(content, {
      schema: 'spec-driven',
      context: null,
      rules: null,
      operations: null,
    })

    expect(updated).not.toContain('\ncontext:')
    expect(updated).not.toContain('\nrules:')
    expect(updated).not.toContain('apply:\n    guidance:')
    expect(updated).not.toContain('archive:')
    expect(updated).toContain('apply:\n    x-review-owner: atlas')
    expect(updated).toContain('deploy:')
    expect(updated).toContain('store: shared-platform')
    expect(() =>
      patchActiveRootOfficialFields('schema: [unterminated\n', {
        schema: 'spec-driven',
        context: null,
        rules: null,
        operations: null,
      })
    ).toThrow(/cannot be edited in Structured mode/i)
  })
})

describe('Active Root mutation admission', () => {
  it('accepts official structured fields and valid custom raw YAML through distinct modes', () => {
    const locator = {
      ownerPath: '/stores/shared',
      filePath: '/stores/shared/openspec/config.yaml',
      revision: `sha256:${'a'.repeat(64)}`,
    }

    expect(
      ActiveRootMutationSchema.parse({
        ...locator,
        mode: 'structured',
        update: {
          schema: 'spec-driven',
          context: null,
          rules: { proposal: ['State evidence.'] },
          operations: { apply: { guidance: ['Run tests.'] }, archive: null },
        },
      })
    ).toMatchObject({ mode: 'structured' })
    expect(
      ActiveRootMutationSchema.parse({
        ...locator,
        mode: 'raw',
        content: 'schema: custom\nx-company: accepted\n',
      })
    ).toMatchObject({ mode: 'raw' })
    expect(validateActiveRootRawYaml('schema: custom\nx-company: accepted\n')).toEqual({
      valid: true,
      diagnostics: [],
    })
    expect(validateActiveRootRawYaml('schema: [unterminated\n')).toMatchObject({
      valid: false,
      diagnostics: [expect.objectContaining({ code: 'config-unparseable' })],
    })
  })
})
