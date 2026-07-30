/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Environment conflict and each unavailable authority outcome retain distinct direct-plane evidence.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 Environment Center。"
 * Review correction (2026-07-30): Store Detail must not collapse source conflict into generic authority loss.
 */
import { describe, expect, it } from 'vitest'
import { selectEnvironmentAuthorityIssue } from './environment-authority-presentation'

describe('Environment authority presentation', () => {
  it('preserves source conflict as an explicit error', () => {
    expect(selectEnvironmentAuthorityIssue('conflict')).toEqual({
      severity: 'error',
      message: 'Current sources disagree on Store evidence for this Environment.',
    })
  })

  it('returns no issue only for current authority', () => {
    expect(selectEnvironmentAuthorityIssue('authority')).toBeNull()
    expect(selectEnvironmentAuthorityIssue('offline')?.message).toContain('offline')
    expect(selectEnvironmentAuthorityIssue('authentication-required')?.message).toContain(
      'authentication'
    )
  })
})
