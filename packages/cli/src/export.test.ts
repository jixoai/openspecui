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
      expect(snapshot.meta.projectDir).toBe(testProjectDir)
      expect(new Date(snapshot.meta.timestamp).getTime()).toBeGreaterThan(0)
    })

    it('should include dashboard statistics', async () => {
      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.dashboard).toBeDefined()
      expect(snapshot.dashboard.specsCount).toBeGreaterThanOrEqual(0)
      expect(snapshot.dashboard.changesCount).toBeGreaterThanOrEqual(0)
      expect(snapshot.dashboard.archivesCount).toBeGreaterThanOrEqual(0)
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
      expect(snapshot.changes[0].parsedTasks).toHaveLength(1)
      expect(snapshot.changes[0].parsedTasks[0].text).toContain('Test task')
      expect(snapshot.changes[0].parsedTasks[0].completed).toBe(false)
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
      expect(snapshot.archives[0].proposal).toContain('Archived Change')
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

    it('should throw error for non-initialized project', async () => {
      const emptyDir = join(tmpdir(), 'openspec-empty-' + Date.now())
      await mkdir(emptyDir, { recursive: true })

      await expect(generateSnapshot(emptyDir)).rejects.toThrow()

      await rm(emptyDir, { recursive: true, force: true })
    })

    it('should handle project with AGENTS.md', async () => {
      await writeFile(
        join(testProjectDir, 'openspec', 'AGENTS.md'),
        '# Agent Instructions\n\nInstructions for AI agents.',
        'utf-8'
      )

      const snapshot = await generateSnapshot(testProjectDir)

      expect(snapshot.agentsMd).toBeDefined()
      expect(snapshot.agentsMd).toContain('Agent Instructions')
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
