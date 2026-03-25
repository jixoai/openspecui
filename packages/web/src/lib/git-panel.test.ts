import { describe, expect, it } from 'vitest'
import {
  buildGitEntryHref,
  buildGitEntryHrefFromEntry,
  buildGitWorktreeHandoffHref,
  isSameGitEntrySelector,
  toGitEntrySelector,
} from './git-panel'

describe('git-panel helpers', () => {
  it('builds hosted handoff urls by replacing only the api query param', () => {
    const href = buildGitWorktreeHandoffHref({
      handoff: {
        projectDir: '/tmp/worktree-b',
        serverUrl: 'http://localhost:3200',
      },
      location: {
        href: 'https://app.openspecui.com/versions/latest/git?api=http%3A%2F%2Flocalhost%3A3100&session=session-a',
        pathname: '/versions/latest/git',
        search: '?api=http%3A%2F%2Flocalhost%3A3100&session=session-a',
        hash: '',
      },
    })

    const url = new URL(href)
    expect(url.origin).toBe('https://app.openspecui.com')
    expect(url.pathname).toBe('/versions/latest/git')
    expect(url.searchParams.get('api')).toBe('http://localhost:3200')
    expect(url.searchParams.get('session')).toBe('session-a')
  })

  it('builds standalone handoff urls by preserving the current route path', () => {
    const href = buildGitWorktreeHandoffHref({
      handoff: {
        projectDir: '/tmp/worktree-b',
        serverUrl: 'http://127.0.0.1:3200',
      },
      location: {
        href: 'http://127.0.0.1:3100/git?_b=%2Fterminal#detail',
        pathname: '/git',
        search: '?_b=%2Fterminal',
        hash: '#detail',
      },
    })

    expect(href).toBe('http://127.0.0.1:3200/git?_b=%2Fterminal#detail')
  })

  it('maps dashboard git entries into stable selectors', () => {
    const commitSelector = toGitEntrySelector({
      type: 'commit',
      hash: 'abc123',
      title: 'feat: add git panel',
      committedAt: 1,
      relatedChanges: [],
      diff: { files: 1, insertions: 3, deletions: 1 },
    })
    const uncommittedSelector = toGitEntrySelector({
      type: 'uncommitted',
      title: 'Uncommitted',
      updatedAt: 2,
      relatedChanges: [],
      diff: { files: 1, insertions: 0, deletions: 0 },
    })

    expect(commitSelector).toEqual({ type: 'commit', hash: 'abc123' })
    expect(uncommittedSelector).toEqual({ type: 'uncommitted' })
    expect(isSameGitEntrySelector(commitSelector, { type: 'commit', hash: 'abc123' })).toBe(true)
    expect(isSameGitEntrySelector(commitSelector, { type: 'commit', hash: 'def456' })).toBe(false)
    expect(isSameGitEntrySelector(uncommittedSelector, { type: 'uncommitted' })).toBe(true)
  })

  it('builds git detail hrefs from selectors and entries', () => {
    expect(buildGitEntryHref({ type: 'uncommitted' })).toBe('/git/uncommitted')
    expect(buildGitEntryHref({ type: 'commit', hash: 'abc123' })).toBe('/git/commit/abc123')
    expect(
      buildGitEntryHrefFromEntry({
        type: 'commit',
        hash: 'def456',
        title: 'feat: add tree',
        committedAt: 1,
        relatedChanges: [],
        diff: { files: 1, insertions: 1, deletions: 0 },
      })
    ).toBe('/git/commit/def456')
  })
})
