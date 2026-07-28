/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Summarize the selected planning root's active OpenSpec config.
 *
 * Original request (2026-07-15): "Active Root Config edits schema, context, and rules for the resolved writable root."
 */
import { CodeEditor } from '@/components/code-editor'
import { useActiveRootConfigViewSubscription } from '@/lib/use-planning-config'

export function OpsxSettingsPanel() {
  const { data: activeRootConfig } = useActiveRootConfigViewSubscription()
  const configYaml = activeRootConfig?.content

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">OpenSpec Config</h3>
        {configYaml ? (
          <CodeEditor value={configYaml} readOnly filename="config.yaml" />
        ) : (
          <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
            openspec/config.yaml not found.
          </div>
        )}
      </section>
    </div>
  )
}
