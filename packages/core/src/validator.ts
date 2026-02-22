import type { Change, Spec } from './schemas.js'

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO'
  message: string
  path?: string
  line?: number
}

export interface ValidationResult {
  valid: boolean
  issues: ValidationIssue[]
}

/**
 * Validator for OpenSpec documents
 */
export class Validator {
  /**
   * Validate a spec document
   */
  validateSpec(spec: Spec): ValidationResult {
    const issues: ValidationIssue[] = []

    // Check overview
    if (!spec.overview || spec.overview.trim().length === 0) {
      issues.push({
        severity: 'ERROR',
        message: 'Spec must have a Purpose/Overview section',
        path: 'overview',
      })
    }

    // Check requirements
    if (spec.requirements.length === 0) {
      issues.push({
        severity: 'ERROR',
        message: 'Spec must have at least one requirement',
        path: 'requirements',
      })
    }

    // Validate each requirement
    for (const req of spec.requirements) {
      if (!req.text.includes('SHALL') && !req.text.includes('MUST')) {
        issues.push({
          severity: 'WARNING',
          message: `Requirement should contain "SHALL" or "MUST": ${req.id}`,
          path: `requirements.${req.id}`,
        })
      }

      if (req.scenarios.length === 0) {
        issues.push({
          severity: 'WARNING',
          message: `Requirement should have at least one scenario: ${req.id}`,
          path: `requirements.${req.id}.scenarios`,
        })
      }

      // Check requirement text length
      if (req.text.length > 1000) {
        issues.push({
          severity: 'WARNING',
          message: `Requirement text is too long (max 1000 chars): ${req.id}`,
          path: `requirements.${req.id}.text`,
        })
      }
    }

    return {
      valid: issues.filter((i) => i.severity === 'ERROR').length === 0,
      issues,
    }
  }

  /**
   * Validate a change proposal
   */
  validateChange(change: Change): ValidationResult {
    const issues: ValidationIssue[] = []

    // Check why section
    if (!change.why || change.why.length < 50) {
      issues.push({
        severity: 'ERROR',
        message: 'Change "Why" section must be at least 50 characters',
        path: 'why',
      })
    }

    if (change.why && change.why.length > 500) {
      issues.push({
        severity: 'WARNING',
        message: 'Change "Why" section should be under 500 characters',
        path: 'why',
      })
    }

    // Check whatChanges section
    if (!change.whatChanges || change.whatChanges.trim().length === 0) {
      issues.push({
        severity: 'ERROR',
        message: 'Change must have a "What Changes" section',
        path: 'whatChanges',
      })
    }

    // Check deltas
    if (change.deltas.length === 0) {
      issues.push({
        severity: 'WARNING',
        message: 'Change should have at least one delta',
        path: 'deltas',
      })
    }

    if (change.deltas.length > 50) {
      issues.push({
        severity: 'WARNING',
        message: 'Change has too many deltas (max 50)',
        path: 'deltas',
      })
    }

    return {
      valid: issues.filter((i) => i.severity === 'ERROR').length === 0,
      issues,
    }
  }
}
