import { getHostedScopedStorageKey } from '@/lib/hosted-session'
import { trpcClient } from '@/lib/trpc'
import {
  BUILTIN_TERMINAL_SPAWN_COMMANDS,
  TerminalInvocationSettingsSchema,
  resolveTerminalShellDefaults,
  type TerminalInvocationSettings,
  type TerminalShellDefaults,
  type TerminalShellProfile,
  type TerminalSpawnCommand,
} from '@openspecui/core/terminal-invocation'

const STORAGE_KEY = 'terminal-invocation-settings'

interface TerminalInvocationConfigSnapshot {
  settings: TerminalInvocationSettings
  shellDefaults: TerminalShellDefaults
  shellProfiles: TerminalShellProfile[]
  spawnCommands: TerminalSpawnCommand[]
  defaultShellProfile: TerminalShellProfile
}

function defaultSettings(): TerminalInvocationSettings {
  return TerminalInvocationSettingsSchema.parse({})
}

function getStorageKey(): string {
  return getHostedScopedStorageKey(STORAGE_KEY, window.location)
}

function readSettings(): TerminalInvocationSettings {
  if (typeof window === 'undefined') return defaultSettings()
  try {
    const raw = localStorage.getItem(getStorageKey())
    if (!raw) return defaultSettings()
    return TerminalInvocationSettingsSchema.parse(JSON.parse(raw) as unknown)
  } catch {
    return defaultSettings()
  }
}

function writeSettings(settings: TerminalInvocationSettings): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getStorageKey(), JSON.stringify(settings))
}

function uniqById<T extends { id: string }>(items: readonly T[]): T[] {
  const indexById = new Map<string, number>()
  const result: T[] = []
  for (const item of items) {
    const existingIndex = indexById.get(item.id)
    if (existingIndex !== undefined) {
      result[existingIndex] = item
      continue
    }
    indexById.set(item.id, result.length)
    result.push(item)
  }
  return result
}

function getFallbackDefaults(): TerminalShellDefaults {
  const platform =
    typeof navigator === 'undefined'
      ? 'common'
      : navigator.platform.toLowerCase().includes('win')
        ? 'windows'
        : 'common'
  return resolveTerminalShellDefaults({
    platform,
  })
}

class TerminalInvocationConfigStore {
  private listeners = new Set<() => void>()
  private settings: TerminalInvocationSettings = defaultSettings()
  private shellDefaults: TerminalShellDefaults | null = null
  private loadingDefaults: Promise<void> | null = null
  private snapshot: TerminalInvocationConfigSnapshot | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.settings = readSettings()
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    void this.ensureShellDefaults()
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): TerminalInvocationConfigSnapshot {
    if (this.snapshot) return this.snapshot

    const shellDefaults = this.shellDefaults ?? getFallbackDefaults()
    const shellProfiles = uniqById([
      ...shellDefaults.builtinShellProfiles,
      ...this.settings.customShellProfiles,
    ])
    const defaultShellProfile =
      shellProfiles.find((profile) => profile.id === this.settings.defaultShellProfileId) ??
      shellDefaults.effectiveDefaultShell
    const snapshot: TerminalInvocationConfigSnapshot = {
      settings: this.settings,
      shellDefaults,
      shellProfiles,
      spawnCommands: uniqById([
        ...BUILTIN_TERMINAL_SPAWN_COMMANDS,
        ...this.settings.customSpawnCommands,
      ]),
      defaultShellProfile,
    }
    this.snapshot = snapshot
    return snapshot
  }

  updateSettings(
    updater: (current: TerminalInvocationSettings) => TerminalInvocationSettings
  ): void {
    const next = TerminalInvocationSettingsSchema.parse(updater(this.settings))
    this.settings = next
    this.snapshot = null
    writeSettings(next)
    this.notify()
  }

  setDefaultShellProfileId(id: string): void {
    this.updateSettings((current) => ({ ...current, defaultShellProfileId: id }))
  }

  upsertCustomShellProfile(profile: TerminalShellProfile): void {
    const parsed = { ...profile, source: 'custom' as const }
    this.updateSettings((current) => ({
      ...current,
      customShellProfiles: [
        ...current.customShellProfiles.filter((item) => item.id !== parsed.id),
        parsed,
      ],
    }))
  }

  removeCustomShellProfile(id: string): void {
    this.updateSettings((current) => ({
      ...current,
      defaultShellProfileId:
        current.defaultShellProfileId === id ? undefined : current.defaultShellProfileId,
      customShellProfiles: current.customShellProfiles.filter((profile) => profile.id !== id),
      customSpawnCommands: current.customSpawnCommands.map((command) =>
        command.shellProfileId === id ? { ...command, shellProfileId: undefined } : command
      ),
    }))
  }

  upsertCustomSpawnCommand(command: TerminalSpawnCommand): void {
    const parsed = { ...command, source: 'custom' as const }
    this.updateSettings((current) => ({
      ...current,
      customSpawnCommands: [
        ...current.customSpawnCommands.filter((item) => item.id !== parsed.id),
        parsed,
      ],
    }))
  }

  removeCustomSpawnCommand(id: string): void {
    this.updateSettings((current) => ({
      ...current,
      customSpawnCommands: current.customSpawnCommands.filter((command) => command.id !== id),
    }))
  }

  private async ensureShellDefaults(): Promise<void> {
    if (this.shellDefaults || this.loadingDefaults) return this.loadingDefaults ?? Promise.resolve()
    this.loadingDefaults = trpcClient.config.getTerminalShellDefaults
      .query()
      .then((defaults) => {
        this.shellDefaults = defaults
        this.snapshot = null
        this.notify()
      })
      .catch(() => {
        this.shellDefaults = getFallbackDefaults()
        this.snapshot = null
        this.notify()
      })
      .finally(() => {
        this.loadingDefaults = null
      })
    return this.loadingDefaults
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export const terminalInvocationConfigStore = new TerminalInvocationConfigStore()
