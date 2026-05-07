import { isStaticMode } from '@/lib/static-mode'
import { queryClient, trpc, trpcClient } from '@/lib/trpc'
import { useConfigSubscription } from '@/lib/use-subscription'
import {
  classifyOpenSpecCliVersion,
  OPENSPEC_CLI_ACCEPTED_RANGE,
  OPENSPEC_CLI_RECOMMENDED_RANGE,
  OPENSPECUI_TARGET_MAJOR,
} from '@openspecui/core/openspec-compat'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertCircle, Loader2, Terminal } from 'lucide-react'
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

  const {
    data,
    isLoading,
    refetch: recheckCli,
    isFetching,
  } = useQuery({
    ...trpc.cli.checkAvailability.queryOptions(),
    staleTime: 0,
    gcTime: 0,
  })
  const [cliCommand, setCliCommand] = useState('')

  const savedCliCommand = useMemo(() => {
    if (!config?.cli?.command) return ''
    return formatExecutePath(config.cli.command, config.cli.args ?? [])
  }, [config?.cli?.args, config?.cli?.command])

  useEffect(() => {
    setCliCommand(savedCliCommand)
  }, [savedCliCommand])

  useEffect(() => {
    void recheckCli()
  }, [config?.cli?.command, config?.cli?.args, recheckCli])

  const saveCliCommandMutation = useMutation({
    mutationFn: (command: string) => trpcClient.config.update.mutate({ cli: { command } }),
    onSuccess: async () => {
      await Promise.allSettled([
        recheckCli(),
        queryClient.invalidateQueries(trpc.cli.checkAvailability.queryFilter()),
        queryClient.invalidateQueries(trpc.config.getEffectiveCliCommand.queryFilter()),
      ])
    },
  })

  if (isLoading) {
    return null
  }

  const compatibility = classifyOpenSpecCliVersion(data?.version)

  if (data?.available && compatibility.status === 'current') {
    return null
  }

  if (data?.available && compatibility.status === 'legacy-compatible') {
    return (
      <div className="fixed bottom-4 right-4 z-40 mx-4 max-w-sm rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <div className="space-y-1">
            <div className="font-medium">OpenSpec CLI {data.version} is legacy-compatible</div>
            <p className="text-muted-foreground text-xs">
              OpenSpecUI {OPENSPECUI_TARGET_MAJOR}.x accepts {OPENSPEC_CLI_ACCEPTED_RANGE}. Upgrade
              to {OPENSPEC_CLI_RECOMMENDED_RANGE} for the current line.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const checking = isFetching || saveCliCommandMutation.isPending

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
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {saveCliCommandMutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
        <div className="text-muted-foreground text-sm">
          Install or upgrade the CLI:
          <code className="bg-muted ml-2 rounded px-1">npm install -g @fission-ai/openspec</code>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => void recheckCli()}
            disabled={checking}
            className="border-border hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-1.5 disabled:opacity-50"
          >
            {checking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Terminal className="h-4 w-4" />
            )}
            {checking ? 'Checking...' : 'Recheck'}
          </button>
        </div>
      </div>
    </div>
  )
}
