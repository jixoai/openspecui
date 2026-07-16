/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Define source-safe Git entry, diff, and worktree projections.
 * 2. Define explicit code/planning repository scope and repository identity.
 * 3. Keep worktree handoff facts separate from repository selection.
 *
 * Original request (2026-07-16): "接下来，你来接手后续工作"
 */
import type {
  DashboardGitDiffStats,
  DashboardGitEntry,
  DashboardGitWorktree,
} from './dashboard-types.js'

export type GitEntryCursor = string

export type GitRepositoryScope = 'code' | 'planning'

export interface GitRepositoryIdentity {
  /** Canonical root of the selected Git worktree. */
  topLevel: string
  /** Canonical common directory shared by linked Git worktrees. */
  commonDir: string
}

export interface GitRepositoryScopeDescriptor {
  scope: GitRepositoryScope
  /** Launch-project or planning-root path that requested this repository. */
  rootPath: string
  /** Null when the requested root does not currently resolve to a Git repository. */
  repository: GitRepositoryIdentity | null
}

export interface GitRepositoryScopes {
  defaultScope: 'code'
  code: GitRepositoryScopeDescriptor & { scope: 'code' }
  /** Present only when the planning root resolves to a distinct Git repository identity. */
  planning: (GitRepositoryScopeDescriptor & { scope: 'planning' }) | null
}

export type GitEntrySelector = { type: 'uncommitted' } | { type: 'commit'; hash: string }

export type GitFileChangeType =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typechanged'
  | 'unmerged'
  | 'unknown'

export type GitPatchState = 'available' | 'binary' | 'too-large' | 'unavailable'
export type GitEntryFileSource = 'tracked' | 'untracked'
export type GitEntryFileDiff =
  | ({ state: 'ready' } & DashboardGitDiffStats)
  | { state: 'loading' | 'unavailable'; files: number }

export type GitWorktreeSummary = Omit<DashboardGitWorktree, 'entries'>

export interface GitEntriesPage {
  items: DashboardGitEntry[]
  nextCursor: GitEntryCursor | null
}

export interface GitEntryFileSummary {
  fileId: string
  source: GitEntryFileSource
  path: string
  displayPath: string
  previousPath: string | null
  changeType: GitFileChangeType
  diff: GitEntryFileDiff
}

export interface GitEntryFilePatch extends GitEntryFileSummary {
  patch: string | null
  state: GitPatchState
}

export interface GitEntryShell {
  entry: DashboardGitEntry | null
  files: GitEntryFileSummary[]
}

export interface GitEntryFiles {
  files: GitEntryFileSummary[]
  eagerFiles: GitEntryFilePatch[]
  eagerPatchLineBudget: number
  eagerPatchLineCount: number
}

export interface GitEntryPatch {
  file: GitEntryFilePatch | null
}

export type GitPatchFile = GitEntryFilePatch

export interface GitEntryDetail {
  entry: DashboardGitEntry | null
  files: GitEntryFilePatch[]
}

export interface GitWorktreeOverview {
  defaultBranch: string
  currentWorktree: GitWorktreeSummary | null
  otherWorktrees: GitWorktreeSummary[]
}

export interface GitWorktreeHandoff {
  projectDir: string
  serverUrl: string
}
