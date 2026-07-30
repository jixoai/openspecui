/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Render Environment evidence as a Stores title-action subpage (7.7).
 * 2. Show connected projects, CLI versions, compatibility facts, and source conflict without becoming primary nav.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 * Spec: hosted-app-distribution › "Product-Shaped Store Index And Detail" (Environment evidence subpage).
 *
 * Pure presentation: the caller supplies observed Environment evidence (connected projects, CLI versions,
 * capabilities, conflict). It is a subpage reached from the Stores title action, not primary navigation.
 */

/** One connected project observed under an Environment. */
export interface EnvironmentEvidenceProject {
  readonly sourceId: string
  readonly label?: string
  readonly cliVersion?: string
  readonly capabilities?: readonly string[]
}

/** One observed Environment's evidence. */
export interface EnvironmentEvidenceEntry {
  readonly envUri: string
  readonly observedAt: number
  readonly projects: readonly EnvironmentEvidenceProject[]
  /** Whether same-Environment sources disagree (conflict). */
  readonly conflict?: { message: string }
}

export interface StoresEnvironmentEvidenceProps {
  readonly environments: readonly EnvironmentEvidenceEntry[]
  /** Return to the Stores index. */
  onBack: () => void
}

/**
 * Environment evidence subpage. Rendered from a Stores title action; shows connected projects, CLI versions,
 * capability facts, and source conflict without becoming primary navigation.
 */
export function StoresEnvironmentEvidence({
  environments,
  onBack,
}: StoresEnvironmentEvidenceProps) {
  return (
    <div className="@container min-w-0 space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="hover:bg-muted rounded-md px-2 py-1 text-sm"
        >
          ← Stores
        </button>
        <h1 className="font-nav text-xl font-bold">Environment evidence</h1>
      </div>

      {environments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No runtime environments observed.</p>
      ) : (
        <div className="space-y-4">
          {environments.map((env) => (
            <section key={env.envUri} className="border-border space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-mono text-sm font-medium">{env.envUri}</h2>
                <span className="text-muted-foreground text-xs">
                  {new Date(env.observedAt).toLocaleString()}
                </span>
              </div>
              {env.conflict ? (
                <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-md border px-2 py-1 text-xs">
                  {env.conflict.message}
                </p>
              ) : null}
              {env.projects.length === 0 ? (
                <p className="text-muted-foreground text-xs">No connected projects observed.</p>
              ) : (
                <ul className="space-y-1">
                  {env.projects.map((project) => (
                    <li
                      key={project.sourceId}
                      className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className="text-foreground font-medium">
                        {project.label ?? project.sourceId}
                      </span>
                      {project.cliVersion ? (
                        <span className="bg-muted rounded px-1.5 py-0.5 text-xs">
                          CLI {project.cliVersion}
                        </span>
                      ) : null}
                      {project.capabilities?.map((capability) => (
                        <span
                          key={capability}
                          className="bg-muted/60 rounded px-1.5 py-0.5 text-xs"
                        >
                          {capability}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
      <p className="text-muted-foreground/70 text-xs">
        Observed environments only. Absence does not imply machine-wide completeness.
      </p>
    </div>
  )
}
