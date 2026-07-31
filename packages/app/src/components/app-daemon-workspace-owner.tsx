/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Apply daemon Workspace snapshots while keeping current credentials in runtime memory.
 * 2. Bind persisted backend locators to current opaque daemon Workspace ids.
 * 3. Expose same-origin open-in-browser actions and objective failures to the App surface.
 * 4. Drive admission decisions so an unchanged snapshot never reopens a user-closed Workspace (3.2/3.7).
 * 5. Project the daemon-owned Favorites/Recent catalog and dispatch persisted favorite commands.
 *
 * Original request (2026-07-29): "Workspaces 的 tab 可以提供一个 open in browser 的 icon-button。"
 * Original request (2026-07-30): "Workspace需要记住曾经打开的目录。"
 *   Closing a Workspace dismisses its daemon admission; an unchanged snapshot produces
 *   `already-dismissed` and must NOT call applyHostedLaunchRequest to reopen it.
 */
import type {
  AppDaemonWorkspaceBinding,
  AppDaemonWorkspaceSnapshot,
} from '@openspecui/core/app-daemon-control'
import {
  createEmptyWorkspaceDirectoryCatalog,
  type WorkspaceDirectoryCatalog,
} from '@openspecui/core/workspace-directory-catalog'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  clearDismissal,
  createEmptyAdmissionState,
  dismissWorkspace,
  reduceDaemonSnapshot,
  type DaemonAdmissionDecision,
  type DaemonWorkspaceAdmissionState,
} from '../lib/daemon-workspace-admission'
import {
  createDaemonWorkspaceControl,
  type DaemonWorkspaceControl,
} from '../lib/daemon-workspace-control'
import { bindLaunchCredential, clearLaunchCredential } from '../lib/launch-credential'
import {
  applyHostedLaunchRequest,
  normalizeHostedApiBaseUrl,
  removeHostedTab,
} from '../lib/shell-state'
import { useConnectionsActions } from '../lib/use-connections'

export interface AppDaemonWorkspaceContextValue {
  /** Latest concrete daemon-control failure. */
  error: string | null
  /** Whether the current App delivery owns the local daemon control surface. */
  availability: 'checking' | 'supported' | 'unsupported'
  /** Complete current daemon Workspace ledger. */
  workspaces: readonly AppDaemonWorkspaceBinding[]
  /** Complete daemon-owned Favorites/Recent catalog; never sourced from browser storage. */
  directoryCatalog: WorkspaceDirectoryCatalog
  /** Ask the daemon to open one opaque current Workspace in the system browser. */
  openWorkspaceInBrowser(workspaceId: string): Promise<void>
  /** Start or join one daemon-managed backend by canonical local directory. */
  startManagedProject(projectDir: string): Promise<AppDaemonWorkspaceBinding>
  /** Stop and settle one exact daemon-managed generation. */
  stopManagedProject(generation: number): Promise<void>
  /** Persist one canonical directory's favorite state in the App daemon. */
  setDirectoryFavorite(canonicalPath: string, favorite: boolean): Promise<void>
  /** Focus or open the exact Workspace represented by one current daemon id. */
  focusWorkspace(workspaceId: string): void
  /** Close Workspace presentation without claiming external process ownership. */
  closeWorkspace(workspaceId: string): void
  /** Resolve a normalized backend locator to its opaque current daemon Workspace id. */
  resolveWorkspaceId(apiBaseUrl: string): string | null
  /**
   * Record that an open Workspace backed by `apiBaseUrl` was closed by the user, so an unchanged
   * daemon snapshot does not reopen it. No-op for non-daemon-backed locators.
   */
  dismissDaemonWorkspace(apiBaseUrl: string): void
}

const AppDaemonWorkspaceContext = createContext<AppDaemonWorkspaceContextValue | null>(null)

const UNSUPPORTED_APP_DAEMON_WORKSPACE_CONTEXT: AppDaemonWorkspaceContextValue = {
  error: null,
  availability: 'unsupported',
  workspaces: [],
  directoryCatalog: createEmptyWorkspaceDirectoryCatalog(),
  openWorkspaceInBrowser: async () => {
    throw new Error('OpenSpecUI App daemon is unavailable.')
  },
  dismissDaemonWorkspace: () => {},
  startManagedProject: async () => {
    throw new Error('Directory launch is unavailable in this App delivery.')
  },
  stopManagedProject: async () => {
    throw new Error('Managed Stop is unavailable in this App delivery.')
  },
  setDirectoryFavorite: async () => {
    throw new Error('Workspace favorite persistence is unavailable in this App delivery.')
  },
  focusWorkspace: () => {},
  closeWorkspace: () => {},
  resolveWorkspaceId: () => null,
}

/**
 * Apply one daemon snapshot as admission decisions.
 *
 * Credentials are bound/cleared for every currently-published workspace (credential freshness is
 * independent of admission). The launch target is opened/focused ONLY for `admit` decisions: a
 * genuinely-new daemon id auto-opens once, while `no-change`/`already-dismissed` never reopen an
 * existing or user-closed Workspace. `retire` clears the locator credential binding.
 */
export function applyDaemonWorkspaceSnapshot(
  snapshot: AppDaemonWorkspaceSnapshot,
  decisions: readonly DaemonAdmissionDecision[],
  applyLaunch: (apiBaseUrl: string) => void
): ReadonlyMap<string, string> {
  const workspaceIds = new Map<string, string>()
  const byId = new Map(snapshot.workspaces.map((workspace) => [workspace.id, workspace] as const))
  const admitSet = new Set(
    decisions
      .filter((decision) => decision.kind === 'admit')
      .map((decision) => decision.workspaceId)
  )
  for (const workspace of snapshot.workspaces) {
    const apiBaseUrl = normalizeHostedApiBaseUrl(workspace.backendUrl)
    if (!apiBaseUrl) continue
    workspaceIds.set(apiBaseUrl, workspace.id)
    if (workspace.credential !== null) {
      bindLaunchCredential(apiBaseUrl, workspace.credential)
    } else {
      clearLaunchCredential(apiBaseUrl)
    }
    if (admitSet.has(workspace.id)) {
      applyLaunch(apiBaseUrl)
    }
  }
  for (const decision of decisions) {
    if (decision.kind !== 'retire') continue
    const workspace = byId.get(decision.workspaceId)
    if (!workspace) continue
    const apiBaseUrl = normalizeHostedApiBaseUrl(workspace.backendUrl)
    if (apiBaseUrl) clearLaunchCredential(apiBaseUrl)
  }
  return workspaceIds
}

/** Own local-daemon Workspace authority for the complete App route lifetime. */
export function AppDaemonWorkspaceOwner({ children }: { children: ReactNode }) {
  const connectionActions = useConnectionsActions()
  const controlRef = useRef<DaemonWorkspaceControl | null>(null)
  // Admission state is runtime-only and credential-free; it tracks which daemon ids have been
  // admitted, dismissed (user-closed), or retired so an unchanged snapshot never reopens a Workspace.
  const admissionRef = useRef<DaemonWorkspaceAdmissionState>(createEmptyAdmissionState())
  const [workspaceIds, setWorkspaceIds] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [workspaces, setWorkspaces] = useState<readonly AppDaemonWorkspaceBinding[]>([])
  const [directoryCatalog, setDirectoryCatalog] = useState<WorkspaceDirectoryCatalog>(() =>
    createEmptyWorkspaceDirectoryCatalog()
  )
  const [availability, setAvailability] = useState<'checking' | 'supported' | 'unsupported'>(
    'checking'
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const control = createDaemonWorkspaceControl({
      baseUrl: window.location.origin,
      onSnapshot: (snapshot) => {
        const ids = snapshot.workspaces.map((workspace) => workspace.id)
        const reduction = reduceDaemonSnapshot(admissionRef.current, ids)
        admissionRef.current = reduction.state
        const applied = applyDaemonWorkspaceSnapshot(
          snapshot,
          reduction.decisions,
          (apiBaseUrl) => {
            // Only `admit` decisions reach here; opening/focusing is admission-driven, not blanket.
            connectionActions.setState(
              applyHostedLaunchRequest(connectionActions.getState(), { apiBaseUrl })
            )
          }
        )
        setWorkspaceIds(applied)
        setWorkspaces(snapshot.workspaces)
        setError(null)
      },
      onDirectorySnapshot: (snapshot) => {
        setDirectoryCatalog(snapshot.catalog)
        setError(null)
      },
      onError: (nextError) => setError(nextError.message),
    })
    controlRef.current = control
    void control.start().then(setAvailability)
    return () => {
      controlRef.current = null
      control.stop()
    }
  }, [connectionActions])

  const openWorkspaceInBrowser = useCallback(async (workspaceId: string) => {
    const control = controlRef.current
    if (!control) throw new Error('OpenSpecUI App daemon is unavailable.')
    try {
      await control.openWorkspaceInBrowser(workspaceId)
      setError(null)
    } catch (nextError) {
      const errorMessage =
        nextError instanceof Error ? nextError.message : 'Failed to open Workspace in browser.'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [])

  const focusWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((candidate) => candidate.id === workspaceId)
      if (!workspace) return
      admissionRef.current = clearDismissal(admissionRef.current, workspace.id)
      connectionActions.setState(
        applyHostedLaunchRequest(connectionActions.getState(), {
          apiBaseUrl: workspace.backendUrl,
        })
      )
    },
    [connectionActions, workspaces]
  )

  const startManagedProject = useCallback(
    async (projectDir: string): Promise<AppDaemonWorkspaceBinding> => {
      const control = controlRef.current
      if (!control || availability !== 'supported') {
        throw new Error('Directory launch is unavailable in this App delivery.')
      }
      const result = await control.startManagedProject(projectDir)
      if (!result.ok) {
        setError(result.error.message)
        throw new Error(result.error.message)
      }
      if (result.workspace.credential) {
        bindLaunchCredential(result.workspace.backendUrl, result.workspace.credential)
      }
      admissionRef.current = clearDismissal(admissionRef.current, result.workspace.id)
      connectionActions.setState(
        applyHostedLaunchRequest(connectionActions.getState(), {
          apiBaseUrl: result.workspace.backendUrl,
        })
      )
      setError(null)
      return result.workspace
    },
    [availability, connectionActions]
  )

  const stopManagedProject = useCallback(
    async (generation: number): Promise<void> => {
      const control = controlRef.current
      if (!control || availability !== 'supported') {
        throw new Error('Managed Stop is unavailable in this App delivery.')
      }
      const workspace = workspaces.find((candidate) => candidate.managedGeneration === generation)
      const result = await control.stopManagedProject(generation)
      if (!result.ok) {
        setError(result.error.message)
        throw new Error(result.error.message)
      }
      if (workspace) {
        clearLaunchCredential(workspace.backendUrl)
        connectionActions.setState(
          removeHostedTab(
            connectionActions.getState(),
            connectionActions.getState().tabs.find((tab) => tab.apiBaseUrl === workspace.backendUrl)
              ?.id ?? ''
          )
        )
      }
      setError(null)
    },
    [availability, connectionActions, workspaces]
  )

  const setDirectoryFavorite = useCallback(
    async (canonicalPath: string, favorite: boolean): Promise<void> => {
      const control = controlRef.current
      if (!control || availability !== 'supported') {
        throw new Error('Workspace favorite persistence is unavailable in this App delivery.')
      }
      try {
        await control.setDirectoryFavorite(canonicalPath, favorite)
        setError(null)
      } catch (nextError) {
        const message =
          nextError instanceof Error
            ? nextError.message
            : 'Failed to persist Workspace favorite state.'
        setError(message)
        throw new Error(message)
      }
    },
    [availability]
  )

  const closeWorkspace = useCallback(
    (workspaceId: string) => {
      const workspace = workspaces.find((candidate) => candidate.id === workspaceId)
      if (!workspace) return
      admissionRef.current = dismissWorkspace(admissionRef.current, workspace.id)
      const tab = connectionActions
        .getState()
        .tabs.find((candidate) => candidate.apiBaseUrl === workspace.backendUrl)
      if (tab) {
        connectionActions.setState(removeHostedTab(connectionActions.getState(), tab.id))
      }
    },
    [connectionActions, workspaces]
  )

  const dismissDaemonWorkspace = useCallback(
    (apiBaseUrl: string) => {
      const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
      const workspaceId = normalized ? workspaceIds.get(normalized) : undefined
      if (!workspaceId) return
      admissionRef.current = dismissWorkspace(admissionRef.current, workspaceId)
    },
    [workspaceIds]
  )

  const value = useMemo<AppDaemonWorkspaceContextValue>(
    () => ({
      error,
      availability,
      workspaces,
      directoryCatalog,
      openWorkspaceInBrowser,
      startManagedProject,
      stopManagedProject,
      setDirectoryFavorite,
      focusWorkspace,
      closeWorkspace,
      dismissDaemonWorkspace,
      resolveWorkspaceId(apiBaseUrl) {
        const normalized = normalizeHostedApiBaseUrl(apiBaseUrl)
        return normalized ? (workspaceIds.get(normalized) ?? null) : null
      },
    }),
    [
      error,
      availability,
      workspaces,
      directoryCatalog,
      openWorkspaceInBrowser,
      startManagedProject,
      stopManagedProject,
      setDirectoryFavorite,
      focusWorkspace,
      closeWorkspace,
      dismissDaemonWorkspace,
      workspaceIds,
    ]
  )

  return (
    <AppDaemonWorkspaceContext.Provider value={value}>
      {children}
    </AppDaemonWorkspaceContext.Provider>
  )
}

/** Read daemon Workspace authority; isolated mounts remain objectively unsupported. */
export function useAppDaemonWorkspace(): AppDaemonWorkspaceContextValue {
  const value = useContext(AppDaemonWorkspaceContext)
  return value ?? UNSUPPORTED_APP_DAEMON_WORKSPACE_CONTEXT
}
