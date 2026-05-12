import { useTerminalInvocationConfig } from '@/lib/use-terminal-invocation-config'
import { ShellProfileSettings } from './shell-profile-settings'
import { SpawnCommandSettings } from './spawn-command-settings'

export function TerminalInvocationSettings() {
  const terminalInvocation = useTerminalInvocationConfig()

  return (
    <div className="border-border/70 space-y-4 rounded-md border p-3">
      <ShellProfileSettings
        shellDefaults={terminalInvocation.shellDefaults}
        shellProfiles={terminalInvocation.shellProfiles}
        defaultShellProfile={terminalInvocation.defaultShellProfile}
      />
      <SpawnCommandSettings
        spawnCommands={terminalInvocation.spawnCommands}
        shellProfiles={terminalInvocation.shellProfiles}
      />
    </div>
  )
}
