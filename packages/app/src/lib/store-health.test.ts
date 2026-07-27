import { describe, expect, it } from 'vitest'
import { deriveHealthFromDiagnostics } from './store-health'

describe('deriveHealthFromDiagnostics', () => {
  it('reports unknown when no diagnostics', () => {
    expect(deriveHealthFromDiagnostics(undefined)).toEqual({
      state: 'unknown',
      label: 'No diagnostics',
    })
    expect(deriveHealthFromDiagnostics([])).toEqual({
      state: 'unknown',
      label: 'No diagnostics',
    })
  })

  it('reports issue for error severity', () => {
    expect(deriveHealthFromDiagnostics([{ severity: 'error', message: 'bad' }])).toEqual({
      state: 'issue',
      label: 'Needs attention',
    })
  })

  it('reports issue for warning severity', () => {
    expect(deriveHealthFromDiagnostics([{ severity: 'warning', message: 'meh' }])).toEqual({
      state: 'issue',
      label: 'Has warnings',
    })
  })

  it('reports healthy for non-error non-warning severities', () => {
    expect(deriveHealthFromDiagnostics([{ severity: 'info', message: 'ok' }])).toEqual({
      state: 'healthy',
      label: 'OK',
    })
  })

  it('never infers ownership or completeness — only presentation state', () => {
    // Diagnostics 是上游事实；本函数只转 severity 为展示态，不输出所有权/完整性结论。
    const summary = deriveHealthFromDiagnostics([{ severity: 'error', message: 'x' }])
    expect(summary.state).toBe('issue')
    expect(summary.label).not.toMatch(/owner|complete|auth|permiss/i)
  })
})
