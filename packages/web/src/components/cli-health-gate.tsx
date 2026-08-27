/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Gate Web compatibility from the shared Root Context CLI evidence only.
 * 2. Preserve session-only bypass and execute-path repair controls.
 * 3. Revalidate the shared Root Context Work through readonly refresh after explicit repair.
 * 4. Recommend installing the admitted CLI series, never an out-of-range `@latest` (issue #258).
 *
 * Original request (2026-07-15): "CLI 1.6 compatibility gate."
 * Original request (2026-07-26): "最终计算结果本质是来自于 OpenSpec CLI 所提供的内容。"
 * Original request (2026-07-27): "普通 pending 不应改变命令标签。"
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 * Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
 * Owner correction (2026-07-31): Root observation refresh is readonly despite internal cache invalidation.
 * Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
 * Owner bypass-lifetime decision (2026-08-01): "仅当前页面会话有效"
 * Original request (2026-08-28, issue #258): "No available OpenSpec CLI runner." — the gate's
 *   install hint must not walk the user into a version this release line then blocks.
 */
import { isStaticMode } from '@/lib/static-mode'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { selectRootContextSnapshot, useContextSubscription } from '@/lib/use-context-subscription'
import { useConfigSubscription } from '@/lib/use-subscription'
import {
  classifyOpenSpecCliVersion,
  OPENSPEC_CLI_ACCEPTED_RANGE,
  OPENSPEC_CLI_TARGET_SERIES,
} from '@openspecui/core/openspec-compat'
import { useMutation } from '@tanstack/react-query'
import { AlertCircle, Loader2, ShieldAlert, Terminal } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

function formatExecutePath(command: string, args: readonly string[] = []): string {
  const quote = (token: string): string => {
    if (!token) return '""'
    if (!/[\s"'\\]/.test(token)) return token
    return JSON.stringify(token)
  }
  return [command, ...args].map(quote).join(' ')
}

export function CliHealthGate() {
  if (isStaticMode()) return null

  const { data: config } = useConfigSubscription()
  const rootSubscription = useContextSubscription()
  const rootContext = selectRootContextSnapshot(rootSubscription.data)
  const data = rootContext?.cli
  const [cliCommand, setCliCommand] = useState('')

  const savedCliCommand = useMemo(() => {
    if (!config?.cli?.command) return ''
    return formatExecutePath(config.cli.command, config.cli.args ?? [])
  }, [config?.cli?.args, config?.cli?.command])

  useEffect(() => {
    setCliCommand(savedCliCommand)
  }, [savedCliCommand])

  const recheckCliMutation = useMutation({
    mutationFn: () => trpcClient.rootContext.refreshProjection.query(),
  })

  const saveCliCommandMutation = useMutation({
    mutationFn: (command: string) => trpcClient.config.update.mutate({ cli: { command } }),
    onSuccess: async () => {
      await Promise.allSettled([
        trpcClient.rootContext.refreshProjection.query(),
        queryClient.invalidateQueries(trpc.config.getEffectiveCliCommand.queryFilter()),
      ])
    },
  })

  // Session-only escape hatch: lets users force OpenSpecUI to work with an
  // out-of-range OpenSpec CLI version. Not persisted — a refresh re-checks.
  const [forceBypassed, setForceBypassed] = useState(false)

  if (rootSubscription.isLoading && !data) {
    return null
  }

  const compatibility = classifyOpenSpecCliVersion(data?.version)

  if (data?.available && (compatibility.supported || forceBypassed)) {
    return null
  }

  const checking =
    recheckCliMutation.isPending ||
    saveCliCommandMutation.isPending ||
    rootSubscription.authority.state === 'waiting' ||
    rootSubscription.data?.state === 'refreshing'

  const reason = !data?.available ? data?.error || 'OpenSpec CLI not found.' : compatibility.message

  return (
    <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="border-border bg-background mx-4 max-w-xl space-y-4 rounded-lg border p-6 shadow-xl">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <AlertCircle className="h-5 w-5 text-amber-500" />
          OpenSpec CLI {OPENSPEC_CLI_ACCEPTED_RANGE} Required
        </div>
        <p className="text-muted-foreground text-sm">{reason}</p>
        <div className="space-y-2">
          <label className="text-sm font-medium">Execute Path</label>
          <p className="text-muted-foreground text-sm">
            Set the exact command used to run OpenSpec. Save will immediately re-check availability.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={cliCommand}
              onChange={(event) => setCliCommand(event.target.value)}
              placeholder='e.g. openspec or "C:\\Program Files\\PowerShell\\7\\pwsh.exe" -File "D:\\a b\\openspec.ps1"'
              className="border-border bg-background text-foreground flex-1 rounded-md border px-3 py-2 font-mono text-sm"
            />
            <button
              onClick={() => saveCliCommandMutation.mutate(cliCommand)}
              disabled={saveCliCommandMutation.isPending || cliCommand.trim() === savedCliCommand}
              aria-busy={saveCliCommandMutation.isPending || undefined}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
        <div className="text-muted-foreground text-sm">
          Install or upgrade the CLI:
          <code className="bg-muted ml-2 rounded px-1">
            npm install -g @fission-ai/openspec@{OPENSPEC_CLI_TARGET_SERIES}
          </code>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => recheckCliMutation.mutate()}
            disabled={checking}
            aria-busy={checking || undefined}
            className="border-border hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-1.5 disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Terminal className="h-4 w-4" />
            )}
            Recheck
          </button>
          {data?.available && (
            <button
              onClick={() => setForceBypassed(true)}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs underline-offset-2 hover:underline"
              title="Force OpenSpecUI to run with this OpenSpec CLI version anyway. Not supported."
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Skip version check
            </button>
          )}
        </div>
        {data?.available && (
          <p className="text-muted-foreground text-xs">
            The detected OpenSpec CLI is usable but outside the supported range. You can skip the
            version check to continue at your own risk; this is a temporary override and is not
            supported.
          </p>
        )}
      </div>
    </div>
  )
}
