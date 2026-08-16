/**
 * Orthogonal intents (updated 2026-07-27 Asia/Shanghai):
 * 1. Build one typed OpenSpec new-change command from user input.
 * 2. Dispatch creation through a dedicated terminal session.
 * 3. Lock preparation and dispatch until Root Context is ready.
 * 4. Preserve and verify the Server-owned planning-root target before dispatch.
 * 5. Keep the public submit guard independent from the disabled-control projection.
 *
 * Original request (2026-07-15): "Root-dependent actions remain locked until root selection succeeds."
 * Original request (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下）。"
 */
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { WorkflowTargetNotice } from '@/components/opsx/workflow-target-notice'
import { AsyncAction } from '@/components/realtime'
import { RootActionNotice, RootCheckingBadge } from '@/components/root-action-notice'
import { navController } from '@/lib/nav-controller'
import { CHANGE_NAME_PATTERN, buildNewChangeArgs, quoteShellToken } from '@/lib/opsx-new-command'
import { isWorkflowTargetCurrent, prepareWorkflowInvocation } from '@/lib/opsx-workflow-invocation'
import { useTerminalContext } from '@/lib/terminal-context'
import { useOpsxConfigBundleSubscription } from '@/lib/use-opsx'
import { useRootActionState } from '@/lib/use-root-action-state'
import { vtNavController } from '@/lib/view-transitions/navigation'
import type { WorkflowInvocationTargetV2 } from '@openspecui/core'
import { Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export function OpsxNewRoute() {
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const { createDedicatedSession } = useTerminalContext()
  const { data: configBundle } = useOpsxConfigBundleSubscription()
  const rootAction = useRootActionState()
  const rootActionRef = useRef(rootAction)
  rootActionRef.current = rootAction

  const [changeName, setChangeName] = useState('')
  const [schema, setSchema] = useState('')
  const [description, setDescription] = useState('')
  const [extraArgs, setExtraArgs] = useState<string[]>([])
  const [extraArgDraft, setExtraArgDraft] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [workflowTarget, setWorkflowTarget] = useState<WorkflowInvocationTargetV2 | null>(null)
  const [preparedCommand, setPreparedCommand] = useState<{
    command: string
    args: string[]
    target: WorkflowInvocationTargetV2 | null
  } | null>(null)

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
      onDismissRequest: null,
    })
  }, [setConfig])

  const trimmedName = changeName.trim()
  const isNameValid = CHANGE_NAME_PATTERN.test(trimmedName)
  const isFormValid = trimmedName.length > 0 && isNameValid
  const preparedTargetCurrent =
    !preparedCommand?.target || isWorkflowTargetCurrent(preparedCommand.target, rootAction)
  const formSubmissionReady = isFormValid && !rootAction.disabled
  const canSubmit = formSubmissionReady && preparedTargetCurrent

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
    if (preparedCommand) {
      return [preparedCommand.command, ...preparedCommand.args].map(quoteShellToken).join(' ')
    }
    if (!isFormValid) {
      return 'openspec new change <change-name>'
    }
    return ['openspec', ...args].map(quoteShellToken).join(' ')
  }, [args, isFormValid, preparedCommand])

  const schemaOptions = configBundle?.schemas.map((item) => item.name) ?? []

  useEffect(() => {
    setPreparedCommand(null)
    setWorkflowTarget(null)
  }, [description, extraArgs, schema, trimmedName])

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
        if (!formSubmissionReady || isSubmitting) return

        const submit = async () => {
          setSubmitError(null)
          setIsSubmitting(true)
          try {
            if (preparedCommand) {
              if (
                preparedCommand.target &&
                !isWorkflowTargetCurrent(preparedCommand.target, rootActionRef.current)
              ) {
                setPreparedCommand(null)
                setWorkflowTarget(null)
                throw new Error(
                  'Planning root changed before dispatch. Prepare this workflow again.'
                )
              }
              const normalizedId = trimmedName
              createDedicatedSession(preparedCommand.command, preparedCommand.args, {
                cwdTarget: preparedCommand.target ? 'planning-root' : 'launch-project',
                ...(preparedCommand.target?.generation
                  ? { expectedRootGeneration: preparedCommand.target.generation }
                  : {}),
                closeTip: 'Press any key or close action to finish this session.',
                closeCallbackUrl: {
                  0: `/changes/${encodeURIComponent(normalizedId)}`,
                },
              })
              const terminalArea = navController.getAreaForPath('/terminal')
              void vtNavController.push(terminalArea, '/terminal', null)
              requestClose()
              return
            }

            setWorkflowTarget(null)
            const result = await prepareWorkflowInvocation({
              requestedMode: 'direct',
              workflowInput: {
                action: 'new',
                changeId: trimmedName,
                schema,
                description,
                extraArgs,
              },
              staticFallback: () => ({
                kind: 'cli-command',
                command: 'openspec',
                args,
                mode: { requestedMode: 'direct', actualMode: 'direct', fallbackReason: null },
                target: null,
                evidence: null,
              }),
            })
            if (result.kind !== 'cli-command') {
              throw new Error('Create change workflow must return a CLI command.')
            }
            setWorkflowTarget(result.target)
            if (result.target && !isWorkflowTargetCurrent(result.target, rootActionRef.current)) {
              setWorkflowTarget(null)
              throw new Error(
                'Planning root changed while preparing this workflow. Refresh and retry.'
              )
            }
            setPreparedCommand({
              command: result.command,
              args: result.args,
              target: result.target,
            })
          } catch (error) {
            setSubmitError(error instanceof Error ? error.message : String(error))
          } finally {
            setIsSubmitting(false)
          }
        }

        void submit()
      }}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-4 w-4" />
          <h2 className="font-nav text-base tracking-[0.04em]">Create OPSX Change</h2>
        </div>
        <RootCheckingBadge state={rootAction} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <RootActionNotice state={rootAction} />
        <WorkflowTargetNotice target={workflowTarget} stale={!preparedTargetCurrent} />

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
        {submitError && <p className="text-destructive text-sm">{submitError}</p>}
      </div>

      <div className="border-border flex items-center justify-end gap-2 border-t px-4 py-3">
        <button
          type="button"
          onClick={requestClose}
          className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
        <AsyncAction
          type="submit"
          disabled={!canSubmit || isSubmitting}
          pending={isSubmitting}
          size="sm"
        >
          Create
        </AsyncAction>
      </div>
    </form>
  )
}
