/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Present CLI-provided project context separately from operation guidance.
 * 2. Keep operation inputs visually distinct from artifact creation rules.
 * 3. Let Change Detail keep non-empty Apply inputs collapsed until explicit user intent.
 *
 * Original request (2026-08-01): preserve OpenSpec 1.7 Apply and Archive operation inputs end to end.
 * Original request (2026-08-03): keep Apply inputs collapsed on the Change Detail default surface.
 */
import { EvidenceDisclosure } from '@/components/information-disclosure'

interface OperationInputsProps {
  title: string
  context?: string
  operationGuidance?: readonly string[]
  showEmpty?: boolean
}

function hasOperationInputs({ context, operationGuidance }: OperationInputsProps): boolean {
  return Boolean(context || operationGuidance?.length)
}

function OperationInputsBody({
  context,
  operationGuidance,
}: Pick<OperationInputsProps, 'context' | 'operationGuidance'>) {
  return (
    <>
      {context ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium">Project context</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{context}</p>
        </div>
      ) : null}
      {operationGuidance?.length ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium">Operation guidance</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {operationGuidance.map((guidance) => (
              <li key={guidance}>{guidance}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!context && !operationGuidance?.length ? (
        <p className="text-muted-foreground text-sm">
          No project context or operation guidance configured.
        </p>
      ) : null}
    </>
  )
}

export function OperationInputs({
  title,
  context,
  operationGuidance,
  showEmpty = false,
}: OperationInputsProps) {
  if (!hasOperationInputs({ title, context, operationGuidance }) && !showEmpty) return null

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label={title}>
      <p className="text-sm font-medium">{title}</p>
      <OperationInputsBody context={context} operationGuidance={operationGuidance} />
    </section>
  )
}

/** Change-owned progressive disclosure for verbose but non-blocking Apply inputs. */
export function OperationInputsDisclosure({
  title,
  context,
  operationGuidance,
}: Omit<OperationInputsProps, 'showEmpty'>) {
  if (!hasOperationInputs({ title, context, operationGuidance })) return null

  const inputCount = Number(Boolean(context)) + (operationGuidance?.length ?? 0)

  return (
    <EvidenceDisclosure
      title={title}
      summary={`${inputCount} ${inputCount === 1 ? 'input' : 'inputs'}`}
    >
      <div className="space-y-3">
        <OperationInputsBody context={context} operationGuidance={operationGuidance} />
      </div>
    </EvidenceDisclosure>
  )
}
