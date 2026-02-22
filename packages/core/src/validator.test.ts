import { describe, expect, it } from 'vitest'
import type { Change, Spec } from '../src/schemas.js'
import { Validator } from '../src/validator.js'

describe('Validator', () => {
  const validator = new Validator()

  describe('validateSpec', () => {
    it('should validate a valid spec', () => {
      const spec: Spec = {
        id: 'test',
        name: 'Test Spec',
        overview: 'This is a test specification.',
        requirements: [
          {
            id: 'req-1',
            text: 'The system SHALL do something',
            scenarios: [{ rawText: '- WHEN test\n- THEN pass' }],
          },
        ],
      }

      const result = validator.validateSpec(spec)

      expect(result.valid).toBe(true)
      expect(result.issues.filter((i) => i.severity === 'ERROR')).toHaveLength(0)
    })

    it('should fail spec without overview', () => {
      const spec: Spec = {
        id: 'test',
        name: 'Test',
        overview: '',
        requirements: [
          {
            id: 'req-1',
            text: 'The system SHALL work',
            scenarios: [{ rawText: 'test' }],
          },
        ],
      }

      const result = validator.validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.path === 'overview')).toBe(true)
    })

    it('should fail spec without requirements', () => {
      const spec: Spec = {
        id: 'test',
        name: 'Test',
        overview: 'Valid overview',
        requirements: [],
      }

      const result = validator.validateSpec(spec)

      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.path === 'requirements')).toBe(true)
    })

    it('should warn about missing SHALL/MUST', () => {
      const spec: Spec = {
        id: 'test',
        name: 'Test',
        overview: 'Valid overview',
        requirements: [
          {
            id: 'req-1',
            text: 'The system will do something',
            scenarios: [{ rawText: 'test' }],
          },
        ],
      }

      const result = validator.validateSpec(spec)

      expect(result.valid).toBe(true) // Warning doesn't fail
      expect(result.issues.some((i) => i.severity === 'WARNING')).toBe(true)
    })

    it('should warn about requirements without scenarios', () => {
      const spec: Spec = {
        id: 'test',
        name: 'Test',
        overview: 'Valid overview',
        requirements: [
          {
            id: 'req-1',
            text: 'The system SHALL work',
            scenarios: [],
          },
        ],
      }

      const result = validator.validateSpec(spec)

      expect(result.valid).toBe(true)
      expect(
        result.issues.some((i) => i.severity === 'WARNING' && i.path?.includes('scenarios'))
      ).toBe(true)
    })
  })

  describe('validateChange', () => {
    it('should validate a valid change', () => {
      const change: Change = {
        id: 'test',
        name: 'Test Change',
        why: 'We need this change because it will improve performance significantly for all users.',
        whatChanges: 'Add caching layer',
        deltas: [
          {
            spec: 'api',
            operation: 'MODIFIED',
            description: 'Update API spec',
          },
        ],
        tasks: [],
        progress: { total: 0, completed: 0 },
      }

      const result = validator.validateChange(change)

      expect(result.valid).toBe(true)
    })

    it('should fail change with short why section', () => {
      const change: Change = {
        id: 'test',
        name: 'Test',
        why: 'Short reason',
        whatChanges: 'Changes',
        deltas: [],
        tasks: [],
        progress: { total: 0, completed: 0 },
      }

      const result = validator.validateChange(change)

      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.path === 'why')).toBe(true)
    })

    it('should fail change without whatChanges', () => {
      const change: Change = {
        id: 'test',
        name: 'Test',
        why: 'A valid reason that is long enough to pass the 50 character minimum requirement.',
        whatChanges: '',
        deltas: [],
        tasks: [],
        progress: { total: 0, completed: 0 },
      }

      const result = validator.validateChange(change)

      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.path === 'whatChanges')).toBe(true)
    })

    it('should warn about missing deltas', () => {
      const change: Change = {
        id: 'test',
        name: 'Test',
        why: 'A valid reason that is long enough to pass the 50 character minimum requirement.',
        whatChanges: 'Some changes',
        deltas: [],
        tasks: [],
        progress: { total: 0, completed: 0 },
      }

      const result = validator.validateChange(change)

      expect(result.valid).toBe(true)
      expect(result.issues.some((i) => i.severity === 'WARNING' && i.path === 'deltas')).toBe(true)
    })
  })
})
