import { CliTerminal } from '@/components/cli-terminal'
import { usePopAreaConfigContext, usePopAreaLifecycleContext } from '@/components/layout/pop-area'
import { useCliRunner } from '@/lib/use-cli-runner'
import { useLocation } from '@tanstack/react-router'
import { CheckCircle, Loader2, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

export function OpsxVerifyRoute() {
  const location = useLocation()
  const { setConfig } = usePopAreaConfigContext()
  const { requestClose } = usePopAreaLifecycleContext()
  const runner = useCliRunner()
  const { lines, status, commands, hasStarted, reset, cancel } = runner
  const [strict, setStrict] = useState(true)

  const changeId = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return params.get('change')?.trim() ?? ''
  }, [location.search])

  useEffect(() => {
    setConfig({
      layout: {
        alignY: 'start',
        width: 'normal',
        topGap: 'comfortable',
      },
      panelClassName: 'w-full',
      bodyClassName: 'p-0',
      maxHeight: 'min(82dvh,760px)',
    })
  }, [setConfig])

  useEffect(() => {
    if (!changeId || hasStarted) return
    const args = ['validate', changeId, '--type', 'change']
    if (strict) args.push('--strict')
    commands.replaceAll([{ command: 'openspec', args }])
    void commands.runAll()
  }, [changeId, commands, hasStarted, strict])

  const rerun = () => {
    if (!changeId) return
    reset()
    const args = ['validate', changeId, '--type', 'change']
    if (strict) args.push('--strict')
    commands.replaceAll([{ command: 'openspec', args }])
    void commands.runAll()
  }

  const handleClose = () => {
    cancel()
    reset()
    requestClose()
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="border-border flex items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-primary h-4 w-4" />
          <h2 className="font-nav text-base tracking-[0.04em]">Verify Change</h2>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={strict}
            onChange={(event) => setStrict(event.target.checked)}
            className="border-border h-3.5 w-3.5 rounded"
            disabled={status === 'running'}
          />
          Strict
        </label>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 p-4">
        {changeId ? (
          <p className="text-muted-foreground text-sm">
            Running validation for <code className="bg-muted rounded px-1">{changeId}</code>.
          </p>
        ) : (
          <p className="text-destructive text-sm">
            Missing change id. Open Verify from a change page.
          </p>
        )}
        <CliTerminal lines={lines} maxHeight="56vh" />
      </div>

      <div className="border-border flex items-center justify-between gap-2 border-t px-4 py-3">
        <div className="text-xs">
          {status === 'success' ? (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle className="h-3.5 w-3.5" />
              Verification completed
            </span>
          ) : status === 'running' ? (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running...
            </span>
          ) : (
            <span className="text-muted-foreground">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-xs"
          >
            Close
          </button>
          <button
            type="button"
            onClick={rerun}
            disabled={!changeId || status === 'running'}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
          >
            Re-run
          </button>
        </div>
      </div>
    </div>
  )
}
