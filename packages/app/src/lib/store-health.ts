import type { StoreDiagnostic } from '@openspecui/core/store-types'

export interface StoreHealthSummary {
  state: 'healthy' | 'issue' | 'unknown'
  label: string
}

/**
 * 从 doctor 诊断客观推导展示健康态。
 *
 * 关键约束（AGENTS.md）：诊断是上游事实；这里只把 severity 转成展示态，
 * 绝不进一步推断为所有权、完整性或权限结论。没有诊断 = unknown，不是 healthy。
 *
 * TODO(kernel): `openspec store doctor --json` 的精确 severity 词汇待用 v1.6 source 审计后对齐。
 */
export function deriveHealthFromDiagnostics(
  diagnostics: StoreDiagnostic[] | undefined
): StoreHealthSummary {
  if (!diagnostics || diagnostics.length === 0) {
    return { state: 'unknown', label: 'No diagnostics' }
  }

  const severities = diagnostics.map((diagnostic) => (diagnostic.severity ?? '').toLowerCase())
  const hasError = severities.some(
    (severity) => severity === 'error' || severity === 'critical' || severity === 'fatal'
  )
  const hasWarning = severities.some((severity) => severity === 'warning' || severity === 'warn')

  if (hasError) return { state: 'issue', label: 'Needs attention' }
  if (hasWarning) return { state: 'issue', label: 'Has warnings' }
  return { state: 'healthy', label: 'OK' }
}
