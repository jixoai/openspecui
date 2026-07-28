/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Render raw Server-owned workflow evidence through the shared collapsed disclosure vocabulary.
 * 2. Preserve the complete typed evidence envelope without acquiring workflow ownership.
 *
 * Original request (2026-07-28): supporting 6.x evidence should use Badge + Tooltip or Accordion.
 */
import { EvidenceDisclosure } from '@/components/information-disclosure'
import type { WorkflowActionEvidenceV2 } from '@openspecui/core'

/** On-demand projection of the complete Server-authored workflow evidence envelope. */
export function WorkflowEvidenceDisclosure({
  evidence,
}: {
  evidence: WorkflowActionEvidenceV2 | null
}) {
  if (!evidence) return null

  return (
    <EvidenceDisclosure title="CLI evidence" summary={evidence.kind}>
      <pre className="text-muted-foreground max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono">
        {JSON.stringify(evidence, null, 2)}
      </pre>
    </EvidenceDisclosure>
  )
}
