/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Derive a path-first Workspace label from objective project path and Git facts (4.0e).
 * 2. Keep this a pure presentation selector: it never mutates directory, backend, tab, frame, or identity.
 * 3. Treat Git facts as display metadata only; canonical physical directory remains the durable identity.
 *
 * Original request (2026-07-30): "Tab这里默认写仓库路径 org/repo，如果没有就使用path的foldername；subtitle写git分支名"
 * Spec: hosted-app-distribution › "Present a path-first Workspace label".
 *
 * Design: the selector consumes typed, already-verified inputs (project path + optional verified GitHub
 * remote + optional current branch). It does NOT clone, resolve, or infer a local directory from a slug, and
 * it never dereferences a remote. A verified GitHub remote yields `org/repo`; otherwise the canonical directory
 * basename is the title. The branch is the subtitle when present. Host/port/locator stay diagnostic-only.
 */

/** Verified Git facts that improve presentation; absent facts fall back gracefully. */
export interface WorkspaceGitFacts {
  /**
   * A verified GitHub remote origin URL (e.g. `https://github.com/org/repo` or `git@github.com:org/repo.git`).
   * The selector derives `org/repo` from it; it never fetches or dereferences the remote.
   */
  readonly githubRemote?: string | null
  /** Current Git branch when available; becomes the subtitle. */
  readonly branch?: string | null
}

/** Objective inputs for one Workspace's path-first presentation. */
export interface WorkspacePathLabelInput {
  /** Canonical project directory path (the durable local identity). */
  readonly projectPath: string
  /** Optional verified Git facts; absent facts produce objective fallbacks. */
  readonly git?: WorkspaceGitFacts | null
}

/** One derived path-first Workspace label. Pure presentation; never mutates identity. */
export interface WorkspacePathLabel {
  /** Verified GitHub `org/repo` slug when available, otherwise the canonical directory basename. */
  readonly title: string
  /** Current Git branch subtitle when available. */
  readonly subtitle: string | null
  /** Complete canonical local path; always retrievable for diagnostics/tooltips. */
  readonly detail: string
  /** The GitHub `org/repo` slug when one was verified; null when the title is a basename fallback. */
  readonly githubSlug: string | null
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com'])

/**
 * Parse a verified remote origin URL into a GitHub `org/repo` slug, or null for non-GitHub remotes.
 *
 * Accepts HTTPS (`https://github.com/org/repo[.git][/...]`) and SSH (`git@github.com:org/repo[.git]`) forms.
 * Returns null for empty, non-GitHub, or unparseable remotes so the caller falls back to the basename.
 * It never dereferences the remote or infers anything beyond the path segments.
 */
export function parseGitHubSlug(remote: string | null | undefined): string | null {
  if (!remote || typeof remote !== 'string') return null
  const trimmed = remote.trim()
  if (!trimmed) return null

  // SSH form: git@github.com:org/repo(.git)
  const sshMatch = /^git@([^:]+):([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(trimmed)
  if (sshMatch) {
    const [, host, org, repo] = sshMatch
    if (host && GITHUB_HOSTS.has(host.toLowerCase()) && org && repo) {
      return `${org}/${repo}`
    }
    return null
  }

  // HTTPS form: https://github.com/org/repo(.git)[/...]
  try {
    const url = new URL(trimmed)
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) return null
    const segments = url.pathname.split('/').filter(Boolean)
    const org = segments[0]
    const repo = segments[1]
    if (!org || !repo) return null
    return `${org}/${repo.replace(/\.git$/, '')}`
  } catch {
    return null
  }
}

/** Derive the canonical directory basename for the title fallback. */
export function directoryBasename(projectPath: string): string {
  const normalized = projectPath.replace(/[\\/]+$/, '')
  if (!normalized) return projectPath
  const segments = normalized.split(/[\\/]+/)
  return segments[segments.length - 1] || normalized
}

/**
 * Pure path-first label selector.
 *
 * title     verified github.com remote -> org/repo
 *           otherwise                  -> canonical directory basename
 * subtitle  current Git branch when available
 * detail    complete canonical path (always retrievable)
 * evidence  backend locator / host / port / raw Git facts remain secondary diagnostics (not modeled here)
 */
export function selectWorkspacePathLabel(input: WorkspacePathLabelInput): WorkspacePathLabel {
  const git = input.git ?? null
  const githubSlug = parseGitHubSlug(git?.githubRemote ?? null)
  const title = githubSlug ?? directoryBasename(input.projectPath)
  const branch = git?.branch
  const subtitle = typeof branch === 'string' && branch.trim().length > 0 ? branch.trim() : null
  return {
    title,
    subtitle,
    detail: input.projectPath,
    githubSlug,
  }
}
