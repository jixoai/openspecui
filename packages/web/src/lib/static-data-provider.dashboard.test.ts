import type { ExportSnapshot } from '@openspecui/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const staticState = vi.hoisted(() => ({
  snapshot: null as ExportSnapshot | null,
}))

vi.mock('./static-mode', () => ({
  getBasePath: () => '/',
  getInitialData: () => staticState.snapshot,
}))

function createSnapshot(): ExportSnapshot {
  return {
    meta: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      projectDir: '/tmp/project',
    },
    dashboard: {
      specsCount: 2,
      changesCount: 2,
      archivesCount: 1,
    },
    config: {
      cli: { command: 'openspec' },
      theme: 'dark',
      codeEditor: {
        theme: 'github',
      },
      opsx: {
        agentInvocationMode: 'compose',
      },
      dashboard: { trendPointLimit: 120 },
      git: { diffEagerLineBudget: 1500 },
      terminal: {
        fontSize: 14,
        fontFamily: 'Menlo',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 2000,
        useTheme: 'app',
        lightTheme: 'default-light',
        darkTheme: 'default-dark',
        rendererEngine: 'xterm',
      },
    },
    specs: [
      {
        id: 'cli',
        name: 'CLI',
        content: '# CLI',
        overview: 'overview',
        requirements: [
          {
            id: 'req-1',
            title: 'a',
            bodyMarkdown: 'a',
            text: 'a',
            scenarios: [{ title: 's1', bodyMarkdown: 's1', rawText: 's1\ns1' }],
          },
          {
            id: 'req-2',
            title: 'b',
            bodyMarkdown: 'b',
            text: 'b',
            scenarios: [{ title: 's2', bodyMarkdown: 's2', rawText: 's2\ns2' }],
          },
          {
            id: 'req-3',
            title: 'c',
            bodyMarkdown: 'c',
            text: 'c',
            scenarios: [{ title: 's3', bodyMarkdown: 's3', rawText: 's3\ns3' }],
          },
        ],
        createdAt: 1,
        updatedAt: 20,
      },
      {
        id: 'ui',
        name: 'UI',
        content: '# UI',
        overview: 'overview',
        requirements: [
          {
            id: 'req-1',
            title: 'a',
            bodyMarkdown: 'a',
            text: 'a',
            scenarios: [{ title: 's1', bodyMarkdown: 's1', rawText: 's1\ns1' }],
          },
        ],
        createdAt: 1,
        updatedAt: 30,
      },
    ],
    changes: [
      {
        id: 'change-a',
        name: 'Change A',
        proposal: '# Proposal',
        tasks: '- [ ] task',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        deltas: [],
        progress: { total: 4, completed: 1 },
        createdAt: 1,
        updatedAt: 30,
      },
      {
        id: 'change-b',
        name: 'Change B',
        proposal: '# Proposal',
        tasks: '- [x] task',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        deltas: [],
        progress: { total: 2, completed: 2 },
        createdAt: 1,
        updatedAt: 15,
      },
    ],
    archives: [
      {
        id: 'archived-x',
        name: 'Archived X',
        entity: {
          stage: 'archive',
          id: 'archived-x',
          exists: true,
          files: [
            { path: 'proposal.md', type: 'file', content: '# Proposal' },
            { path: 'tasks.md', type: 'file', content: '- [x] Archived task' },
          ],
          artifacts: [],
          ungroupedFiles: [
            { path: 'proposal.md', type: 'file', content: '# Proposal' },
            { path: 'tasks.md', type: 'file', content: '- [x] Archived task' },
          ],
          diagnostics: [],
        },
        createdAt: 1,
        updatedAt: 1,
      },
    ],
  }
}

describe('static-data-provider dashboard overview', () => {
  beforeEach(() => {
    vi.resetModules()
    staticState.snapshot = createSnapshot()
  })

  it('builds objective dashboard overview from snapshot', async () => {
    const provider = await import('./static-data-provider')
    const overview = await provider.getDashboardOverview()

    expect(overview.summary).toEqual({
      specifications: 2,
      requirements: 4,
      activeChanges: 2,
      inProgressChanges: 1,
      completedChanges: 1,
      archivedTasksCompleted: 1,
      tasksTotal: 6,
      tasksCompleted: 3,
      taskCompletionPercent: 50,
    })

    expect(overview.specifications.map((spec) => spec.id)).toEqual(['ui', 'cli'])
    expect(overview.activeChanges.map((change) => change.id)).toEqual(['change-a', 'change-b'])
    expect(overview.trends.specifications.length).toBeGreaterThan(0)
    expect(overview.trends.requirements.length).toBeGreaterThan(0)
    expect(overview.trends.completedChanges.length).toBeGreaterThan(0)
    expect(overview.trends.activeChanges).toEqual([])
    expect(overview.trends.inProgressChanges).toEqual([])
    expect(overview.trends.taskCompletionPercent).toEqual([])
    expect(overview.triColorTrends.specifications).toEqual([])
    expect(overview.triColorTrends.requirements).toEqual([])
    expect(overview.triColorTrends.completedChanges).toEqual([])
    expect(overview.trendKinds.requirements).toBe('monotonic')
    expect(overview.trendKinds.activeChanges).toBe('bidirectional')
    expect(overview.cardAvailability.requirements).toEqual({ state: 'ok' })
    expect(overview.cardAvailability.activeChanges).toEqual({
      state: 'invalid',
      reason: 'objective-history-unavailable',
    })
    expect(overview.cardAvailability.inProgressChanges).toEqual({
      state: 'invalid',
      reason: 'objective-history-unavailable',
    })
    expect(overview.cardAvailability.taskCompletionPercent).toEqual({
      state: 'invalid',
      reason: 'objective-history-unavailable',
    })
    expect(overview.trendMeta.pointLimit).toBe(120)
    expect(overview.trendMeta.lastUpdatedAt).toBeGreaterThan(0)
  })

  it('limits dashboard lists to the 10 most recent items while keeping summary totals intact', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      specs: Array.from({ length: 12 }, (_, index) => ({
        id: `spec-${index}`,
        name: `Spec ${index}`,
        content: `# Spec ${index}`,
        overview: 'overview',
        requirements: Array.from({ length: 12 - index }, (_, requirementIndex) => ({
          id: `req-${index}-${requirementIndex}`,
          title: 'requirement',
          bodyMarkdown: 'requirement',
          text: 'requirement',
          scenarios: [
            { title: 'scenario', bodyMarkdown: 'scenario', rawText: 'scenario\nscenario' },
          ],
        })),
        createdAt: 1,
        updatedAt: index + 1,
      })),
      changes: Array.from({ length: 12 }, (_, index) => ({
        id: `change-${index}`,
        name: `Change ${index}`,
        proposal: '# Proposal',
        tasks: '- [ ] task',
        why: 'why',
        whatChanges: 'what',
        parsedTasks: [],
        deltas: [],
        progress: { total: 1, completed: index % 2 },
        createdAt: 1,
        updatedAt: index + 1,
      })),
    }

    const provider = await import('./static-data-provider')
    const overview = await provider.getDashboardOverview()

    expect(overview.summary.specifications).toBe(12)
    expect(overview.summary.activeChanges).toBe(12)
    expect(overview.specifications).toHaveLength(10)
    expect(overview.activeChanges).toHaveLength(10)
    expect(overview.specifications.map((spec) => spec.id)).toEqual([
      'spec-11',
      'spec-10',
      'spec-9',
      'spec-8',
      'spec-7',
      'spec-6',
      'spec-5',
      'spec-4',
      'spec-3',
      'spec-2',
    ])
    expect(overview.activeChanges.map((change) => change.id)).toEqual([
      'change-11',
      'change-10',
      'change-9',
      'change-8',
      'change-7',
      'change-6',
      'change-5',
      'change-4',
      'change-3',
      'change-2',
    ])
  })

  it('prioritizes dated archive id for completed trend positioning', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      archives: [
        {
          id: '2026-01-23-add-static-export',
          name: 'Archive A',
          entity: {
            stage: 'archive',
            id: '2026-01-23-add-static-export',
            exists: true,
            files: [{ path: 'summary.md', type: 'file', content: '# Archive A' }],
            artifacts: [],
            ungroupedFiles: [{ path: 'summary.md', type: 'file', content: '# Archive A' }],
            diagnostics: [],
          },
          createdAt: 2_000_000_000_000,
          updatedAt: 2_000_000_000_000,
        },
        {
          id: '2026-02-21-opsx-config-center',
          name: 'Archive B',
          entity: {
            stage: 'archive',
            id: '2026-02-21-opsx-config-center',
            exists: true,
            files: [{ path: 'summary.md', type: 'file', content: '# Archive B' }],
            artifacts: [],
            ungroupedFiles: [{ path: 'summary.md', type: 'file', content: '# Archive B' }],
            diagnostics: [],
          },
          createdAt: 2_000_000_000_000,
          updatedAt: 2_000_000_000_000,
        },
      ],
    }

    const provider = await import('./static-data-provider')
    const overview = await provider.getDashboardOverview()
    const nonZeroIndexes = overview.trends.completedChanges
      .map((point, index) => ({ point, index }))
      .filter(({ point }) => point.value > 0)
      .map(({ index }) => index)

    expect(nonZeroIndexes).toHaveLength(2)
    expect(nonZeroIndexes[1]! - nonZeroIndexes[0]!).toBeGreaterThan(8)
  })

  it('returns static ui config from snapshot when present', async () => {
    const provider = await import('./static-data-provider')
    const config = await provider.getConfig()

    expect(config.theme).toBe('dark')
    expect(config.dashboard.trendPointLimit).toBe(120)
    expect(config.git.diffEagerLineBudget).toBe(1500)
    expect(config.opsx.agentInvocationMode).toBe('compose')
    expect(config.terminal.scrollback).toBe(2000)
    expect(config.cli.command).toBe('openspec')
  })

  it('maps snapshot git commits into dashboard git snapshot', async () => {
    staticState.snapshot = {
      ...createSnapshot(),
      git: {
        defaultBranch: 'origin/main',
        repositoryUrl: 'https://github.com/jixoai/openspecui',
        latestCommitTs: 1_710_000_000_000,
        recentCommits: [
          {
            hash: 'aaaaaaaa',
            title: 'feat: add dashboard',
            committedAt: 1_710_000_000_000,
            relatedChanges: ['dashboard-live-workflow-status'],
            diff: { files: 3, insertions: 20, deletions: 5 },
          },
          {
            hash: 'bbbbbbbb',
            title: 'fix: align static trends',
            committedAt: 1_709_900_000_000,
            relatedChanges: [],
            diff: { files: 1, insertions: 4, deletions: 2 },
          },
        ],
      },
    }

    const provider = await import('./static-data-provider')
    const overview = await provider.getDashboardOverview()
    const worktree = overview.git.worktrees[0]

    expect(overview.git.defaultBranch).toBe('origin/main')
    expect(worktree?.branchName).toBe('(snapshot)')
    expect(worktree?.path).toBe('https://github.com/jixoai/openspecui')
    expect(worktree?.entries).toHaveLength(2)
    expect(worktree?.entries[0]).toMatchObject({
      type: 'commit',
      hash: 'aaaaaaaa',
      committedAt: 1_710_000_000_000,
      relatedChanges: ['dashboard-live-workflow-status'],
    })
  })
})
