import { useOpsxSchemaDetailSubscription, useOpsxSchemasSubscription } from '@/lib/use-opsx'
import { Layers } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export function Schemas() {
  const { data: schemas, isLoading, error } = useOpsxSchemasSubscription()
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!selected && schemas && schemas.length > 0) {
      setSelected(schemas[0].name)
    }
  }, [schemas, selected])

  const selectedInfo = useMemo(
    () => schemas?.find((schema) => schema.name === selected),
    [schemas, selected]
  )

  const { data: detail } = useOpsxSchemaDetailSubscription(selected ?? undefined)

  if (isLoading && !schemas) {
    return <div className="route-loading animate-pulse">Loading schemas...</div>
  }

  if (error) {
    return <div className="text-destructive">Failed to load schemas: {error.message}</div>
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <h1 className="font-nav flex items-center gap-2 text-2xl font-bold">
        <Layers className="h-6 w-6 shrink-0" />
        Schemas
      </h1>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="border-border divide-border divide-y overflow-hidden rounded-lg border">
          {schemas?.map((schema) => {
            const isSelected = schema.name === selected
            return (
              <button
                key={schema.name}
                type="button"
                onClick={() => setSelected(schema.name)}
                className={`flex w-full items-start gap-2 px-4 py-3 text-left transition ${
                  isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex flex-1 flex-col gap-1">
                  <span className="font-medium">{schema.name}</span>
                  <span className="text-muted-foreground text-xs">{schema.description}</span>
                  <span className="text-muted-foreground text-[10px]">Source: {schema.source}</span>
                </div>
              </button>
            )
          })}
          {schemas?.length === 0 && (
            <div className="text-muted-foreground p-4 text-sm">No schemas available.</div>
          )}
        </div>

        <div className="border-border min-h-0 rounded-lg border p-4">
          {selectedInfo ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold">{selectedInfo.name}</h2>
                <p className="text-muted-foreground text-sm">{selectedInfo.description}</p>
              </div>

              {detail && (
                <div className="space-y-4">
                  <section>
                    <h3 className="text-sm font-semibold">Artifacts</h3>
                    <div className="mt-2 space-y-2">
                      {detail.artifacts.map((artifact) => (
                        <div
                          key={artifact.id}
                          className="border-border rounded-md border px-3 py-2 text-xs"
                        >
                          <div className="font-medium">{artifact.id}</div>
                          <div className="text-muted-foreground">{artifact.outputPath}</div>
                          {artifact.description && (
                            <div className="text-muted-foreground mt-1">{artifact.description}</div>
                          )}
                          {artifact.requires.length > 0 && (
                            <div className="mt-1 text-[10px]">
                              Requires: {artifact.requires.join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold">Apply Requirements</h3>
                    <div className="text-muted-foreground mt-2 text-xs">
                      {detail.applyRequires.length > 0 ? detail.applyRequires.join(', ') : 'None'}
                    </div>
                  </section>

                  {detail.applyInstruction && (
                    <section>
                      <h3 className="text-sm font-semibold">Apply Instruction</h3>
                      <p className="text-muted-foreground mt-2 whitespace-pre-wrap text-xs">
                        {detail.applyInstruction}
                      </p>
                    </section>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">Select a schema to view details.</div>
          )}
        </div>
      </div>
    </div>
  )
}
