/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Present CLI-provided project context separately from operation guidance.
 * 2. Keep operation inputs visually distinct from artifact creation rules.
 *
 * Original request (2026-08-01): preserve OpenSpec 1.7 Apply and Archive operation inputs end to end.
 */
export function OperationInputs({
  title,
  context,
  operationGuidance,
  showEmpty = false,
}: {
  title: string
  context?: string
  operationGuidance?: readonly string[]
  showEmpty?: boolean
}) {
  if (!context && !operationGuidance?.length && !showEmpty) return null

  return (
    <section className="space-y-3 rounded-lg border p-3" aria-label={title}>
      <p className="text-sm font-medium">{title}</p>
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
    </section>
  )
}
