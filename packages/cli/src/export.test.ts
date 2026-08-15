/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Verify static export produces the expected OpenSpec project snapshot.
 * 2. Verify export combines local planning artifacts with CLI-backed schema projection.
 * 3. Cover Reference-aware export materialization and publication behavior.
 * 4. Preserve recursive Spec identity and source content through owned export.
 *
 * Prove typed schemas-capture outcomes in exported snapshots.
 * Original request (2026-07-14): "openspec 1.6.0 已经放出，我们需要开始进行适配。"
 * Original request (2026-08-01): adapt OpenSpec 1.7 nested Spec ids such as `platform/auth`.
 
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"*/
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateSnapshot } from './export.js'

describe('Export Functions', () => {
  let testProjectDir: string
  let testOutputDir: string

  beforeEach(async () => {
    // Create temporary test directories
    const tmpBase = join(tmpdir(), 'openspec-test-' + Date.now())
    testProjectDir = join(tmpBase, 'project')
    testOutputDir = join(tmpBase, 'output')

    await mkdir(testProjectDir, { recursive: true })
    await mkdir(join(testProjectDir, 'openspec'), { recursive: true })
    await mkdir(join(testProjectDir, 'openspec', 'specs'), { recursive: true })
    await mkdir(join(testProjectDir, 'openspec', 'changes'), { recursive: true })
    await mkdir(join(testProjectDir, 'openspec', 'changes', 'archive'), { recursive: true })
    await writeFile(
      join(testProjectDir, 'openspec', '.openspecui.json'),
      JSON.stringify(
        {
          cli: {
            // Prevent tests from probing global/npx runners (can block on network).
            command: '__openspec_test_no_cli__',
          },
          theme: 'system',
          terminal: { rendererEngine: 'xterm' },
          dashboard: { trendPointLimit: 40 },
        },
        null,
        2
      ),
      'utf-8'
    )

    // Create minimal project.md
    await writeFile(
      join(testProjectDir, 'openspec', 'project.md'),
      '# Test Project\n\nTest project for export tests.',
      'utf-8'
    )
  })

  afterEach(async () => {
    // Clean up test directories
    if (existsSync(testProjectDir)) {
      await rm(testProjectDir, { recursive: true, force: true })
    }
    if (existsSync(testOutputDir)) {
      await rm(testOutputDir, { recursive: true, force: true })
    }
  })

  describe('generateSnapshot', () => {
    it('should generate a valid snapshot with metadata', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot).toBeDefined()
      expect(snapshot.meta).toBeDefined()
      expect(snapshot.meta.timestamp).toBeDefined()
      expect(snapshot.meta.version).toBeDefined()
      // The absolute project path is intentionally not retained; only a display-safe name survives.
      expect(snapshot.meta.projectName).toMatch(/\S/)
      expect(snapshot.meta).not.toHaveProperty('projectDir')
      expect(snapshot.meta.observedAt).toBeGreaterThan(0)
      expect(snapshot.meta.root).toBeDefined()
      expect(snapshot.meta.referencePolicy).toEqual({ kind: 'none' })
      expect(new Date(snapshot.meta.timestamp).getTime()).toBeGreaterThan(0)
    })

    it('should include dashboard statistics', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.dashboard).toBeDefined()
      expect(snapshot.dashboard.specsCount).toBeGreaterThanOrEqual(0)
      expect(snapshot.dashboard.changesCount).toBeGreaterThanOrEqual(0)
      expect(snapshot.dashboard.archivesCount).toBeGreaterThanOrEqual(0)
    })

    it('should include ui config for static consumption', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.config).toBeDefined()
      expect(snapshot.config?.terminal.rendererEngine).toBe('xterm')
      expect(snapshot.config?.dashboard.trendPointLimit).toBeGreaterThanOrEqual(20)
    })

    it('should include empty arrays when no specs/changes exist', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.specs).toBeInstanceOf(Array)
      expect(snapshot.changes).toBeInstanceOf(Array)
      expect(snapshot.archives).toBeInstanceOf(Array)
    })

    it('should include projectMd content if present', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.projectMd).toBeDefined()
      expect(snapshot.projectMd).toContain('Test Project')
    })

    it('should include opsx config section', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.opsx).toBeDefined()
      expect(snapshot.opsx?.schemas).toBeInstanceOf(Array)
      // This fixture runs without an available CLI runner, so the schemas
      // observation is captured as a typed failure instead of a silent empty catalog.
      const capture = snapshot.opsx?.schemasCapture
      if (capture?.ok !== false) throw new Error('Expected a typed schemas capture failure.')
      expect(capture.command).toBe('openspec schemas')
      expect(capture.selector).toBeNull()
      expect(capture.rootAvailable).toBe(false)
      expect(capture.diagnostics).toEqual([])
      expect(capture.stdout).toBe('')
      expect(capture.exitCode).toBeNull()
      expect(capture.payload).toBeNull()
      expect(capture.contractError).toBeUndefined()
      // The runner failure surfaces through the captured stderr evidence.
      expect(capture.stderr).toEqual(expect.stringContaining('OpenSpec CLI'))
      expect(snapshot.opsx?.schemaDetails).toBeDefined()
      expect(snapshot.opsx?.templates).toBeDefined()
    })

    it('should parse spec files correctly', async () => {
      // Create a test spec
      const specDir = join(testProjectDir, 'openspec', 'specs', 'test-spec')
      await mkdir(specDir, { recursive: true })
      await writeFile(
        join(specDir, 'spec.md'),
        `# Test Spec

## Purpose
Test specification for unit tests.

## Requirements
### Requirement: Test requirement
The system SHALL support testing.

#### Scenario: Test scenario
- WHEN running tests
- THEN tests SHALL pass
`,
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.specs).toHaveLength(1)
      expect(snapshot.specs[0].id).toBe('test-spec')
      expect(snapshot.specs[0].name).toBe('Test Spec')
      expect(snapshot.specs[0].content).toContain('Test Spec')
      expect(snapshot.specs[0].requirements).toHaveLength(1)
      expect(snapshot.specs[0].requirements[0].text).toContain('Test requirement')
      expect(snapshot.specs[0].requirements[0].scenarios).toHaveLength(1)
    })

    it('should export processed spec content while preserving source content', async () => {
      await writeFile(
        join(testProjectDir, 'openspec', 'openspecui.hooks.ts'),
        `
export async function onReadDocument(ctx, read) {
  const result = await read()
  if (ctx.document.kind !== 'spec') return result
  return {
    ...result,
    markdown: result.markdown.replaceAll('CLI_0003', 'CLI_0003 - Reqstool enriched title'),
  }
}
`,
        'utf-8'
      )

      const specDir = join(testProjectDir, 'openspec', 'specs', 'cli')
      await mkdir(specDir, { recursive: true })
      await writeFile(
        join(specDir, 'spec.md'),
        `# CLI Spec

## Purpose
CLI_0003

## Requirements
### Requirement: CLI_0003
The system SHALL show CLI_0003.

#### Scenario: Requirement id only
- WHEN rendering the spec
- THEN CLI_0003 is visible
`,
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.specs[0].content).toContain('Reqstool enriched title')
      expect(snapshot.specs[0].sourceContent).toContain('CLI_0003')
      expect(snapshot.specs[0].sourceContent).not.toContain('Reqstool enriched title')
    })

    it('should parse change files correctly', async () => {
      // Create a test change
      const changeDir = join(testProjectDir, 'openspec', 'changes', 'test-change')
      await mkdir(changeDir, { recursive: true })
      await writeFile(
        join(changeDir, 'proposal.md'),
        `# Change: Test Change

## Why
Testing purposes.

## What Changes
- Test change item

## Impact
- No impact
`,
        'utf-8'
      )

      await writeFile(
        join(changeDir, 'tasks.md'),
        `## 1. Implementation
- [ ] 1.1 Test task
`,
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.changes).toHaveLength(1)
      expect(snapshot.changes[0].id).toBe('test-change')
      expect(snapshot.changes[0].proposal).toContain('Test Change')
      expect(snapshot.changes[0].tasks).toContain('Test task')
      expect(snapshot.changes[0].trackedTaskProgress.tasks).toHaveLength(1)
      expect(snapshot.changes[0].trackedTaskProgress.tasks[0].text).toContain('Test task')
      expect(snapshot.changes[0].trackedTaskProgress.tasks[0].completed).toBe(false)
    })

    it('should snapshot schema change task progress without proposal.md', async () => {
      const changeDir = join(testProjectDir, 'openspec', 'changes', 'vision-change')
      await mkdir(join(testProjectDir, 'openspec', 'schemas', 'vision-driven'), { recursive: true })
      await mkdir(join(changeDir, 'plans'), { recursive: true })
      await writeFile(join(changeDir, '.openspec.yaml'), 'schema: vision-driven\n', 'utf-8')
      await writeFile(
        join(testProjectDir, 'openspec', 'schemas', 'vision-driven', 'schema.yaml'),
        `name: vision-driven
artifacts:
  - id: plan
    generates: plans/*.md
  - id: tasks
    generates: tasks.md
apply:
  tracks: tasks.md
`,
        'utf-8'
      )
      await writeFile(join(changeDir, 'tasks.md'), '- [x] Done\n- [ ] Todo\n', 'utf-8')
      await writeFile(join(changeDir, 'plans', 'plan.md'), '- [x] Planned\n', 'utf-8')

      const snapshot = await generateSnapshot(testProjectDir)
      const change = snapshot.changes.find((item) => item.id === 'vision-change')

      expect(change?.proposal).toBe('')
      expect(change?.trackedTaskProgress).toMatchObject({
        total: 2,
        completed: 1,
        phase: 'in-progress',
      })
      expect(change?.trackedTaskProgress.tasks.map((task) => task.text)).toEqual(['Done', 'Todo'])
      expect(change?.documentChecklistSummary).toMatchObject({ total: 3, completed: 2 })
    })

    it('should parse change with deltas correctly', async () => {
      // Create a test change with delta spec
      const changeDir = join(testProjectDir, 'openspec', 'changes', 'test-change-with-delta')
      await mkdir(changeDir, { recursive: true })
      await mkdir(join(changeDir, 'specs', 'auth'), { recursive: true })

      await writeFile(
        join(changeDir, 'proposal.md'),
        `# Change: Add Auth Feature

## Why
Need authentication.

## What Changes
- Add login

## Impact
- New capability
`,
        'utf-8'
      )

      await writeFile(
        join(changeDir, 'specs', 'auth', 'spec.md'),
        `## ADDED Requirements
### Requirement: User Login
The system SHALL support login.

#### Scenario: Successful login
- WHEN user provides credentials
- THEN user is authenticated
`,
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.changes).toHaveLength(1)
      expect(snapshot.changes[0].deltas).toHaveLength(1)
      expect(snapshot.changes[0].deltas[0].capability).toBe('auth')
      expect(snapshot.changes[0].deltas[0].content).toContain('User Login')
    })

    it('should parse archived changes correctly', async () => {
      // Create an archived change
      const archiveDir = join(
        testProjectDir,
        'openspec',
        'changes',
        'archive',
        '2025-01-01-test-archive'
      )
      await mkdir(archiveDir, { recursive: true })

      await writeFile(
        join(archiveDir, 'proposal.md'),
        `# Change: Archived Change

## Why
Historical change.

## What Changes
- Old feature

## Impact
- Completed
`,
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.archives).toHaveLength(1)
      expect(snapshot.archives[0].id).toBe('2025-01-01-test-archive')
      expect(snapshot.archives[0].entity.files).toContainEqual(
        expect.objectContaining({
          path: 'proposal.md',
          type: 'file',
          content: expect.stringContaining('Archived Change'),
        })
      )
    })

    it('should snapshot custom schema archive entity files without proposal.md', async () => {
      const archiveDir = join(
        testProjectDir,
        'openspec',
        'changes',
        'archive',
        '2026-05-17-custom-audit'
      )
      await mkdir(join(archiveDir, 'reports'), { recursive: true })
      await writeFile(join(archiveDir, '.openspec.yaml'), 'schema: custom-audit\n', 'utf-8')
      await writeFile(
        join(archiveDir, 'reports', 'summary.md'),
        '# Audit Summary\n\n- [x] Reviewed\n',
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)
      const archive = snapshot.archives.find((item) => item.id === '2026-05-17-custom-audit')

      expect(archive).toBeDefined()
      expect(archive?.entity.schemaName).toBe('custom-audit')
      expect(archive?.entity.files.map((file) => file.path)).toContain('reports/summary.md')
      expect(archive?.entity.diagnostics.map((item) => item.message).join('\n')).toContain(
        'custom-audit'
      )
      expect(archive?.trackedTaskProgress).toMatchObject({
        total: 0,
        completed: 0,
        phase: 'no-tasks',
      })
      expect(archive?.documentChecklistSummary).toMatchObject({ total: 1, completed: 1 })
    })

    it('should handle spec with multiple requirements', async () => {
      const specDir = join(testProjectDir, 'openspec', 'specs', 'multi-req-spec')
      await mkdir(specDir, { recursive: true })
      await writeFile(
        join(specDir, 'spec.md'),
        `# Multi Requirement Spec

## Purpose
Test spec with multiple requirements.

## Requirements
### Requirement: First requirement
The system SHALL do first thing.

#### Scenario: First scenario
- WHEN first condition
- THEN first result

### Requirement: Second requirement
The system SHALL do second thing.

#### Scenario: Second scenario
- WHEN second condition
- THEN second result
`,
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.specs).toHaveLength(1)
      expect(snapshot.specs[0].requirements).toHaveLength(2)
      expect(snapshot.specs[0].requirements[0].text).toContain('First requirement')
      expect(snapshot.specs[0].requirements[1].text).toContain('Second requirement')
    })

    it('exports a recursive owned Spec without flattening identity or source content', async () => {
      const specDir = join(testProjectDir, 'openspec', 'specs', 'platform', 'auth')
      await mkdir(specDir, { recursive: true })
      const source = `# Platform Auth Specification

## Purpose
Nested authentication.

## Requirements

### Requirement: Preserve identity
The platform SHALL preserve recursive Spec identity.

#### Scenario: Export nested Spec
- **WHEN** the project is exported
- **THEN** every Spec identity segment is retained
`
      await writeFile(join(specDir, 'spec.md'), source, 'utf-8')

      const snapshot = await generateSnapshot(testProjectDir)
      const spec = snapshot.specs.find((entry) => entry.identity.specId === 'platform/auth')

      expect(spec).toMatchObject({
        identity: { kind: 'owned', specId: 'platform/auth' },
        source: 'owned',
        readOnly: false,
        id: 'platform/auth',
        content: expect.stringContaining('Preserve identity'),
        sourceContent: source,
      })
      expect(spec?.requirements).toHaveLength(1)
    })

    it('should throw error for non-initialized project', async () => {
      const emptyDir = join(tmpdir(), 'openspec-empty-' + Date.now())
      await mkdir(emptyDir, { recursive: true })

      await expect(generateSnapshot(emptyDir)).rejects.toThrow()

      await rm(emptyDir, { recursive: true, force: true })
    })

    it('should generate consistent timestamps in ISO format', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      // Timestamp should be a valid ISO string
      const timestamp = snapshot.meta.timestamp
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/)

      // Should be parseable as a valid date
      const date = new Date(timestamp)
      expect(date.getTime()).toBeGreaterThan(0)

      // Should be recent (within the last minute)
      const now = Date.now()
      const timeDiff = now - date.getTime()
      expect(timeDiff).toBeLessThan(60000) // Less than 60 seconds
    })

    it('should include version information', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.meta.version).toBeDefined()
      expect(typeof snapshot.meta.version).toBe('string')
      expect(snapshot.meta.version).toMatch(/^\d+\.\d+\.\d+/)
    })
  })
})
