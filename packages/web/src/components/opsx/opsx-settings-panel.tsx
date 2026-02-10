import { CodeEditor } from '@/components/code-editor'
import { useOpsxChangeListSubscription, useOpsxChangeMetadataSubscription, useOpsxProjectConfigSubscription } from '@/lib/use-opsx'
import { useEffect, useState } from 'react'

export function OpsxSettingsPanel() {
  const { data: configYaml } = useOpsxProjectConfigSubscription()
  const { data: changeIds } = useOpsxChangeListSubscription()
  const [selectedChange, setSelectedChange] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!selectedChange && changeIds && changeIds.length > 0) {
      setSelectedChange(changeIds[0])
    }
  }, [changeIds, selectedChange])

  const { data: changeMeta } = useOpsxChangeMetadataSubscription(selectedChange)

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

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Change Metadata</h3>
          {changeIds && changeIds.length > 0 && (
            <select
              value={selectedChange}
              onChange={(e) => setSelectedChange(e.target.value)}
              className="border-border rounded-md border bg-card px-2 py-1 text-xs"
            >
              {changeIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedChange && changeMeta ? (
          <CodeEditor value={changeMeta} readOnly filename=".openspec.yaml" />
        ) : (
          <div className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
            {selectedChange ? 'No metadata file found.' : 'No changes available.'}
          </div>
        )}
      </section>
    </div>
  )
}
