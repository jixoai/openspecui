/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Lock OpenSpec 1.6 root, Store, Reference, validate, and archive payloads.
 * 2. Prove additive-field tolerance and required-field strictness.
 * 3. Prove process evidence and raw JSON survive success and failure parsing.
 * 4. Prove multiline requirement bodies remain intact.
 *
 * Original request (2026-07-15): "1.4、1.5、1.6 第一方合同回归测试。"
 */
import { describe, expect, it } from 'vitest'
import type { CliResult } from '../cli-executor.js'
import { parseCliCommandResult } from './command-result.js'
import { CliDoctorSchema, CliStoreDoctorSchema } from './store.js'
import {
  CliArchiveSchema,
  CliArtifactInstructionsSchema,
  CliShowSpecSchema,
  CliValidateSchema,
  CliWorkflowStatusSchema,
} from './workflow.js'

function result(payload: unknown, overrides: Partial<CliResult> = {}): CliResult {
  return {
    success: true,
    stdout: JSON.stringify(payload),
    stderr: '',
    exitCode: 0,
    ...overrides,
  }
}

describe('OpenSpec CLI command contract parsing', () => {
  it.each([
    { source: 'nearest', path: '/repo', store_id: undefined },
    { source: 'declared', path: '/stores/shared', store_id: 'shared' },
    { source: 'store', path: '/stores/shared', store_id: 'shared' },
  ] as const)('preserves $source root provenance', (root) => {
    const parsed = parseCliCommandResult(
      result({
        root: { ...root, healthy: true, status: [], upstreamAddition: true },
        store: null,
        references: [],
        status: [],
      }),
      CliDoctorSchema
    )

    expect(parsed.contractError).toBeUndefined()
    expect(parsed.data?.root).toMatchObject({
      source: root.source,
      path: root.path,
      ...(root.store_id ? { store_id: root.store_id } : {}),
    })
    expect(parsed.payload).toMatchObject({ root: { upstreamAddition: true } })
  })

  it('preserves direct healthy, missing, and unhealthy Reference evidence', () => {
    const parsed = parseCliCommandResult(
      result({
        root: { path: '/repo', source: 'nearest', healthy: true, status: [] },
        store: null,
        references: [
          {
            store_id: 'healthy',
            root: '/stores/healthy',
            specs: [{ id: 'auth', summary: 'Authentication.' }],
            fetch: 'openspec show <spec-id> --type spec --store healthy',
            status: [],
          },
          {
            store_id: 'missing',
            status: [
              {
                severity: 'warning',
                code: 'reference_unresolved',
                message: 'Reference is not registered.',
              },
            ],
          },
          {
            store_id: 'unhealthy',
            status: [
              {
                severity: 'warning',
                code: 'reference_root_unhealthy',
                message: 'Reference root is unhealthy.',
              },
            ],
          },
        ],
        status: [],
      }),
      CliDoctorSchema
    )

    expect(parsed.data?.references).toHaveLength(3)
    expect(parsed.data?.references[0]?.specs?.[0]?.id).toBe('auth')
    expect(parsed.data?.references[1]?.status[0]?.code).toBe('reference_unresolved')
    expect(parsed.data?.references[2]?.status[0]?.code).toBe('reference_root_unhealthy')
  })

  it('accepts an empty healthy Store whose optional planning directories are absent', () => {
    const parsed = parseCliCommandResult(
      result({
        stores: [
          {
            id: 'empty',
            root: '/stores/empty',
            metadata_path: '/stores/empty/.openspec-store/store.yaml',
            openspec_root: {
              present: true,
              config: { present: true, path: 'openspec/config.yaml' },
              specs: { present: false },
              changes: { present: false },
              archive: { present: false },
              healthy: true,
              status: [],
            },
            metadata: { present: true, valid: true, id: 'empty', remote: null },
            git: {
              is_repository: true,
              has_commits: true,
              has_uncommitted_changes: false,
              has_remote: false,
              origin_url: null,
            },
            status: [],
          },
        ],
        status: [],
      }),
      CliStoreDoctorSchema
    )

    expect(parsed.contractError).toBeUndefined()
    expect(parsed.data?.stores[0]?.openspec_root).toMatchObject({
      healthy: true,
      specs: { present: false },
      changes: { present: false },
      archive: { present: false },
    })
  })

  it('keeps a multiline requirement body without truncation', () => {
    const text = 'The system begins here.\nIt SHALL preserve the complete requirement body.'
    const parsed = parseCliCommandResult(
      result({
        id: 'auth',
        title: 'Authentication',
        overview: 'Authentication behavior.',
        requirementCount: 1,
        requirements: [
          { text, scenarios: [{ rawText: '#### Scenario: Login\n- **WHEN** valid' }] },
        ],
        metadata: { version: '1.0.0', format: 'openspec' },
        root: { path: '/repo', source: 'nearest' },
      }),
      CliShowSpecSchema
    )

    expect(
      parsed.data && 'requirements' in parsed.data ? parsed.data.requirements[0]?.text : null
    ).toBe(text)
  })

  it('preserves exit status and strict validation issues on a failing report', () => {
    const parsed = parseCliCommandResult(
      result(
        {
          items: [
            {
              id: 'bad-change',
              type: 'change',
              valid: false,
              issues: [
                {
                  level: 'ERROR',
                  path: 'specs/auth/spec.md',
                  message: 'Requirement must contain SHALL or MUST.',
                  line: 3,
                },
              ],
              durationMs: 2,
            },
          ],
          summary: {
            totals: { items: 1, passed: 0, failed: 1 },
            byType: { change: { items: 1, passed: 0, failed: 1 } },
          },
          version: '1.0',
          root: { path: '/repo', source: 'nearest' },
        },
        { success: false, stderr: 'validation failed', exitCode: 1 }
      ),
      CliValidateSchema
    )

    expect(parsed.success).toBe(false)
    expect(parsed.exitCode).toBe(1)
    expect(parsed.stderr).toBe('validation failed')
    expect(
      parsed.data && 'items' in parsed.data ? parsed.data.items[0]?.issues[0]?.line : null
    ).toBe(3)
  })

  it('preserves scenario-loss archive diagnostics and the failure null-shape', () => {
    const parsed = parseCliCommandResult(
      result(
        {
          archive: null,
          root: { path: '/repo', source: 'nearest' },
          status: [
            {
              severity: 'error',
              code: 'archive_spec_update_failed',
              message: 'MODIFIED requirement would remove existing scenarios.',
            },
          ],
        },
        { success: false, exitCode: 1 }
      ),
      CliArchiveSchema
    )

    expect(parsed.data?.archive).toBeNull()
    expect(parsed.diagnostics[0]?.code).toBe('archive_spec_update_failed')
    expect(parsed.exitCode).toBe(1)
  })

  it('preserves the complete 1.6 workflow Status action contract', () => {
    const parsed = parseCliCommandResult(
      result({
        changeName: 'add-auth',
        schemaName: 'custom',
        planningHome: {
          kind: 'repo',
          root: '/store',
          changesDir: '/store/openspec/changes',
          defaultSchema: 'spec-driven',
        },
        changeRoot: '/store/openspec/changes/add-auth',
        artifactPaths: {
          specs: {
            outputPath: 'specs/**/*.md',
            resolvedOutputPath: '/store/openspec/changes/add-auth/specs/**/*.md',
            existingOutputPaths: ['/store/openspec/changes/add-auth/specs/auth/spec.md'],
          },
        },
        isComplete: false,
        applyRequires: ['tasks'],
        nextSteps: ['Run openspec instructions tasks --change "add-auth" --store shared --json.'],
        actionContext: {
          mode: 'repo-local',
          sourceOfTruth: 'repo',
          planningArtifacts: ['specs', 'tasks'],
          linkedContext: [],
          allowedEditRoots: ['/store'],
          requiresAffectedAreaSelection: false,
          constraints: ['Repo-local edits only.'],
        },
        artifacts: [{ id: 'tasks', outputPath: 'tasks.md', status: 'ready' }],
        root: { path: '/store', source: 'store', store_id: 'shared' },
      }),
      CliWorkflowStatusSchema
    )

    expect(parsed.contractError).toBeUndefined()
    expect(parsed.data).toMatchObject({
      changeRoot: '/store/openspec/changes/add-auth',
      artifactPaths: {
        specs: {
          existingOutputPaths: ['/store/openspec/changes/add-auth/specs/auth/spec.md'],
        },
      },
      actionContext: { allowedEditRoots: ['/store'] },
      root: { source: 'store', store_id: 'shared' },
    })
  })

  it('preserves artifact templates, rules, glob outputs, and direct References', () => {
    const parsed = parseCliCommandResult(
      result({
        changeName: 'add-auth',
        artifactId: 'specs',
        schemaName: 'custom',
        changeDir: '/store/openspec/changes/add-auth',
        planningHome: {
          kind: 'repo',
          root: '/store',
          changesDir: '/store/openspec/changes',
          defaultSchema: 'spec-driven',
        },
        outputPath: 'specs/**/*.md',
        resolvedOutputPath: '/store/openspec/changes/add-auth/specs/**/*.md',
        existingOutputPaths: ['/store/openspec/changes/add-auth/specs/auth/spec.md'],
        description: 'Delta specs.',
        instruction: 'Update concrete files only.',
        context: 'Security context.',
        rules: ['Preserve scenarios.'],
        template: '# Delta',
        dependencies: [],
        unlocks: [],
        references: [{ store_id: 'platform', root: '/stores/platform', status: [] }],
        root: { path: '/store', source: 'store', store_id: 'shared' },
      }),
      CliArtifactInstructionsSchema
    )

    expect(parsed.contractError).toBeUndefined()
    expect(parsed.data).toMatchObject({
      template: '# Delta',
      rules: ['Preserve scenarios.'],
      existingOutputPaths: ['/store/openspec/changes/add-auth/specs/auth/spec.md'],
      references: [{ store_id: 'platform' }],
    })
  })

  it('keeps the raw payload and reports missing required semantics as contract drift', () => {
    const payload = { root: { path: '/repo' }, store: null, references: [], status: [] }
    const parsed = parseCliCommandResult(result(payload), CliDoctorSchema)

    expect(parsed.data).toBeNull()
    expect(parsed.payload).toEqual(payload)
    expect(parsed.contractError).toContain('root.source')
  })
})
