/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Present CLI-provided project context separately from operation guidance.
 * 2. Keep operation inputs visually distinct from artifact creation rules.
 * 3. Let Change Detail expose non-empty Apply inputs through an Action-owned bounded Dialog.
 *
 * Original request (2026-08-01): preserve OpenSpec 1.7 Apply and Archive operation inputs end to end.
 * Original request (2026-08-03): keep Apply inputs collapsed on the Change Detail default surface.
 * Owner correction (2026-08-03): make Apply inputs one Header Action that opens a Dialog.
 */
import { Dialog } from '@/components/dialog'
import { ListTree } from 'lucide-react'
import { useState } from 'react'

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

/** Optional Change Header Action whose bounded Dialog owns read-only Apply inputs. */
export function OperationInputsDialogAction({
  title,
  context,
  operationGuidance,
}: Omit<OperationInputsProps, 'showEmpty'>) {
  const [open, setOpen] = useState(false)
  if (!hasOperationInputs({ title, context, operationGuidance })) return null

  return (
    <>
      <button
        type="button"
        aria-label={title}
        onClick={() => setOpen(true)}
        className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition"
      >
        <ListTree className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden sm:inline">{title}</span>
      </button>
      <Dialog
        open={open}
        title={<span className="text-sm font-semibold">{title}</span>}
        onClose={() => setOpen(false)}
        maxHeight="min(80vh, 40rem)"
        bodyClassName="space-y-3"
      >
        <OperationInputsBody context={context} operationGuidance={operationGuidance} />
      </Dialog>
    </>
  )
}
