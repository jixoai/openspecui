/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove the path-first label uses verified GitHub org/repo or falls back to the directory basename (4.0e).
 * 2. Prove branch is the subtitle and the complete path stays retrievable.
 * 3. Prove changing remote/branch updates display only and never identity.
 *
 * Original request (2026-07-30): "Tab这里默认写仓库路径 org/repo，如果没有就使用path的foldername；subtitle写git分支名"
 */
import { describe, expect, it } from 'vitest'
import {
  directoryBasename,
  parseGitHubSlug,
  selectWorkspacePathLabel,
} from './workspace-path-label'

describe('parseGitHubSlug (4.0e)', () => {
  it('parses an HTTPS GitHub remote into org/repo', () => {
    expect(parseGitHubSlug('https://github.com/gaubee/openspecui')).toBe('gaubee/openspecui')
    expect(parseGitHubSlug('https://github.com/gaubee/openspecui.git')).toBe('gaubee/openspecui')
    expect(parseGitHubSlug('https://github.com/gaubee/openspecui/')).toBe('gaubee/openspecui')
  })

  it('parses an SSH GitHub remote into org/repo', () => {
    expect(parseGitHubSlug('git@github.com:gaubee/openspecui.git')).toBe('gaubee/openspecui')
    expect(parseGitHubSlug('git@github.com:gaubee/openspecui')).toBe('gaubee/openspecui')
  })

  it('returns null for non-GitHub remotes, empty, or unparseable input', () => {
    expect(parseGitHubSlug('https://gitlab.com/gaubee/openspecui')).toBeNull()
    expect(parseGitHubSlug('git@bitbucket.org:gaubee/openspecui.git')).toBeNull()
    expect(parseGitHubSlug('')).toBeNull()
    expect(parseGitHubSlug(null)).toBeNull()
    expect(parseGitHubSlug(undefined)).toBeNull()
    expect(parseGitHubSlug('not a url')).toBeNull()
  })
})

describe('selectWorkspacePathLabel (4.0e)', () => {
  it('uses the verified GitHub org/repo as the title when available', () => {
    const label = selectWorkspacePathLabel({
      projectPath: '/Users/kzf/Dev/projects/openspecui',
      git: { githubRemote: 'https://github.com/gaubee/openspecui.git', branch: 'main' },
    })
    expect(label.title).toBe('gaubee/openspecui')
    expect(label.githubSlug).toBe('gaubee/openspecui')
    expect(label.subtitle).toBe('main')
    // The complete path remains retrievable as detail.
    expect(label.detail).toBe('/Users/kzf/Dev/projects/openspecui')
  })

  it('falls back to the canonical directory basename when no GitHub remote is verified', () => {
    const label = selectWorkspacePathLabel({
      projectPath: '/Users/kzf/Dev/projects/openspecui',
      git: { githubRemote: 'https://gitlab.com/gaubee/openspecui', branch: 'dev' },
    })
    expect(label.title).toBe('openspecui')
    expect(label.githubSlug).toBeNull()
    expect(label.subtitle).toBe('dev')
  })

  it('falls back to the basename and null subtitle when Git facts are absent', () => {
    const label = selectWorkspacePathLabel({
      projectPath: '/var/lib/projects/legacy-project',
    })
    expect(label.title).toBe('legacy-project')
    expect(label.subtitle).toBeNull()
    expect(label.githubSlug).toBeNull()
  })

  it('trims a trailing slash before deriving the basename', () => {
    expect(directoryBasename('/a/b/c/')).toBe('c')
    expect(directoryBasename('/a/b/c')).toBe('c')
    expect(directoryBasename('/')).toBe('/')
  })

  it('changing the remote or branch updates display only; the path detail (identity) is unchanged', () => {
    const before = selectWorkspacePathLabel({
      projectPath: '/Users/kzf/Dev/projects/openspecui',
      git: { githubRemote: 'https://github.com/gaubee/openspecui.git', branch: 'main' },
    })
    // The remote changes (e.g. renamed repo) and the branch changes.
    const after = selectWorkspacePathLabel({
      projectPath: '/Users/kzf/Dev/projects/openspecui',
      git: {
        githubRemote: 'https://github.com/gaubee/openspecui-renamed.git',
        branch: 'feature/x',
      },
    })
    // Display changed.
    expect(after.title).toBe('gaubee/openspecui-renamed')
    expect(after.subtitle).toBe('feature/x')
    // Identity (canonical path detail) is identical.
    expect(after.detail).toBe(before.detail)
  })

  it('never exposes host/port/locator as a primary label', () => {
    const label = selectWorkspacePathLabel({
      projectPath: '/projects/a',
      git: { branch: 'main' },
    })
    expect(JSON.stringify(label)).not.toContain('port')
    expect(JSON.stringify(label)).not.toContain('localhost')
    expect(JSON.stringify(label)).not.toContain('apiBaseUrl')
  })
})
