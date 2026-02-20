import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { navController } from '@/lib/nav-controller'
import { CHANGE_NAME_PATTERN, buildNewChangeArgs, quoteShellToken } from '@/lib/opsx-new-command'
import { useTerminalContext } from '@/lib/terminal-context'
import { useOpsxConfigBundleSubscription } from '@/lib/use-opsx'
import { Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export function OpsxNewRoute() {
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { createDedicatedSession } = useTerminalContext()
  const { data: configBundle } = useOpsxConfigBundleSubscription()

  const [changeName, setChangeName] = useState('')
  const [schema, setSchema] = useState('')
  const [description, setDescription] = useState('')
  const [extraArgs, setExtraArgs] = useState<string[]>([])
  const [extraArgDraft, setExtraArgDraft] = useState('')

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'normal',
        topGap: 'comfortable',
      },
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(86dvh,900px)',
    })
  }, [setConfig])

  const trimmedName = changeName.trim()
  const isNameValid = CHANGE_NAME_PATTERN.test(trimmedName)
  const canSubmit = trimmedName.length > 0 && isNameValid

  const args = useMemo(
    () =>
      buildNewChangeArgs({
        changeName,
        schema,
        description,
        extraArgs,
      }),
    [changeName, schema, description, extraArgs]
  )

  const commandPreview = useMemo(() => {
    if (!canSubmit) {
      return 'openspec new change <change-name>'
    }
    return ['openspec', ...args].map(quoteShellToken).join(' ')
  }, [args, canSubmit])

  const schemaOptions = configBundle?.schemas.map((item) => item.name) ?? []

  const addExtraArg = () => {
    const token = extraArgDraft.trim()
    if (token.length === 0) return
    setExtraArgs((prev) => [...prev, token])
    setExtraArgDraft('')
  }

  return (
    <form
      className="flex h-full min-h-0 min-w-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        if (!canSubmit) return

        const normalizedId = trimmedName
        const closeCallbackUrl = {
          0: `/changes/${encodeURIComponent(normalizedId)}`,
        }

        createDedicatedSession('openspec', args, {
          closeTip: 'Press any key or close action to finish this session.',
          closeCallbackUrl,
        })

        const terminalArea = navController.getAreaForPath('/terminal')
        navController.push(terminalArea, '/terminal', null)
        requestClose()
      }}
    >
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <Sparkles className="text-primary h-4 w-4" />
        <h2 className="font-nav text-base tracking-[0.04em]">Create OPSX Change</h2>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Change Name</span>
          <input
            autoFocus
            value={changeName}
            onChange={(event) => setChangeName(event.target.value)}
            placeholder="add-search-poparea"
            className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
          {trimmedName.length > 0 && !isNameValid && (
            <span className="text-destructive text-xs">
              Use kebab-case: lowercase letters, numbers, and single hyphens.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Schema</span>
          <input
            list="opsx-new-schema-options"
            value={schema}
            onChange={(event) => setSchema(event.target.value)}
            placeholder="(optional)"
            className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
          <datalist id="opsx-new-schema-options">
            {schemaOptions.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="(optional)"
            rows={3}
            className="border-input bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          />
        </label>

        <details className="group rounded-md border border-dashed">
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium">
            Advanced Arguments
          </summary>
          <div className="border-border flex flex-col gap-3 border-t px-3 py-3">
            <div className="flex gap-2">
              <input
                value={extraArgDraft}
                onChange={(event) => setExtraArgDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  addExtraArg()
                }}
                placeholder="--my-flag"
                className="border-input bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
              />
              <button
                type="button"
                onClick={addExtraArg}
                className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm"
              >
                Add
              </button>
            </div>

            {extraArgs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extraArgs.map((token, index) => (
                  <span
                    key={`${token}-${index}`}
                    className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                  >
                    {token}
                    <button
                      type="button"
                      onClick={() => {
                        setExtraArgs((prev) => prev.filter((_, i) => i !== index))
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Remove argument ${token}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-muted-foreground text-xs">
              Extra args are appended at the end of the command and can override earlier flags.
            </p>
          </div>
        </details>

        <div className="bg-muted/40 border-border rounded-md border p-3">
          <div className="text-muted-foreground mb-1 text-xs uppercase tracking-wider">Command</div>
          <code className="break-all text-xs">{commandPreview}</code>
        </div>
      </div>

      <div className="border-border flex items-center justify-end gap-2 border-t px-4 py-3">
        <button
          type="button"
          onClick={requestClose}
          className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </form>
  )
}
