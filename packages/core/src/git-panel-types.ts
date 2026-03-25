import type {
  DashboardGitDiffStats,
  DashboardGitEntry,
  DashboardGitWorktree,
} from './dashboard-types.js'

export type GitEntryCursor = string

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

export interface GitEntryPatch {
  entry: DashboardGitEntry | null
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
