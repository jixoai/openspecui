import { describe, expect, it } from 'vitest'
import { MarkdownParser } from '../src/parser.js'

describe('MarkdownParser', () => {
  const parser = new MarkdownParser()

  describe('parseSpec', () => {
    it('should parse a basic spec', () => {
      const content = `# User Authentication

## Purpose
This spec defines user authentication requirements.

## Requirements
### Requirement: Login functionality
The system SHALL allow users to login with email and password.

#### Scenario: Successful login
- WHEN user enters valid credentials
- THEN user is authenticated
- AND redirected to dashboard
`
      const spec = parser.parseSpec('auth', content)

      expect(spec.id).toBe('auth')
      expect(spec.name).toBe('User Authentication')
      expect(spec.overview).toContain('user authentication requirements')
      expect(spec.requirements).toHaveLength(1)
      expect(spec.requirements[0].text).toContain('Login functionality')
      expect(spec.requirements[0].scenarios).toHaveLength(1)
    })

    it('should handle multiple requirements', () => {
      const content = `# API Spec

## Purpose
API specifications.

## Requirements
### Requirement: GET endpoint
The system SHALL expose GET endpoints.

### Requirement: POST endpoint
The system SHALL expose POST endpoints.
`
      const spec = parser.parseSpec('api', content)

      expect(spec.requirements).toHaveLength(2)
      expect(spec.requirements[0].text).toContain('GET endpoint')
      expect(spec.requirements[1].text).toContain('POST endpoint')
    })

    it('should handle empty spec', () => {
      const spec = parser.parseSpec('empty', '')

      expect(spec.id).toBe('empty')
      expect(spec.name).toBe('empty')
      expect(spec.overview).toBe('')
      expect(spec.requirements).toHaveLength(0)
    })
  })

  describe('parseChange', () => {
    it('should parse a basic change', () => {
      const proposal = `# Add caching feature

## Why
We need caching to improve performance significantly for our users. This will reduce API calls and improve response times.

## What Changes
- Add Redis caching layer
- Update API endpoints

## Impact
- Affected specs: \`specs/api\`
`
      const tasks = `## Implementation
- [x] Setup Redis
- [ ] Add cache middleware
`
      const change = parser.parseChange('add-caching', proposal, tasks)

      expect(change.id).toBe('add-caching')
      expect(change.name).toBe('Add caching feature')
      expect(change.why).toContain('improve performance')
      expect(change.whatChanges).toContain('Redis')
      expect(change.deltas).toHaveLength(1)
      expect(change.deltas[0].spec).toBe('api')
      expect(change.tasks).toHaveLength(2)
      expect(change.progress.total).toBe(2)
      expect(change.progress.completed).toBe(1)
    })

    it('should handle change without tasks', () => {
      const proposal = `# Feature

## Why
A very good reason for this change that explains the business value clearly.

## What Changes
Some changes
`
      const change = parser.parseChange('feature', proposal)

      expect(change.tasks).toHaveLength(0)
      expect(change.progress.total).toBe(0)
      expect(change.progress.completed).toBe(0)
    })
  })

  describe('parseTasks', () => {
    it('should parse task list', () => {
      const content = `## Setup
- [x] Install dependencies
- [ ] Configure environment

## Implementation
- [ ] Write code
- [X] Review design
`
      const tasks = parser.parseTasks(content)

      expect(tasks).toHaveLength(4)
      expect(tasks[0].completed).toBe(true)
      expect(tasks[0].section).toBe('Setup')
      expect(tasks[1].completed).toBe(false)
      expect(tasks[2].section).toBe('Implementation')
      expect(tasks[3].completed).toBe(true) // [X] should also work
    })

    it('should handle empty content', () => {
      const tasks = parser.parseTasks('')
      expect(tasks).toHaveLength(0)
    })
  })

  describe('serializeSpec', () => {
    it('should serialize spec back to markdown', () => {
      const spec = {
        id: 'test',
        name: 'Test Spec',
        overview: 'This is a test.',
        requirements: [
          {
            id: 'req-1',
            text: 'Test requirement',
            scenarios: [{ rawText: '- WHEN test\n- THEN pass' }],
          },
        ],
      }

      const markdown = parser.serializeSpec(spec)

      expect(markdown).toContain('# Test Spec')
      expect(markdown).toContain('## Purpose')
      expect(markdown).toContain('This is a test.')
      expect(markdown).toContain('### Requirement: Test requirement')
      expect(markdown).toContain('- WHEN test')
    })
  })
})
