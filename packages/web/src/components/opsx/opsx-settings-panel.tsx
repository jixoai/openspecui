import { CodeEditor } from '@/components/code-editor'
import { useOpsxProjectConfigSubscription } from '@/lib/use-opsx'

export function OpsxSettingsPanel() {
  const { data: configYaml } = useOpsxProjectConfigSubscription()

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
