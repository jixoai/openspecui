import { describe, expect, it } from 'vitest'

import {
  createReleasePlan,
  createReleaseStepDefinitions,
  parseReleaseCommitHashes,
  readPackageVersionFromJson,
  resolveBaselineReleaseCommit,
} from './plan'

describe('release plan helpers', () => {
  it('selects the previous release commit when HEAD is already the release commit', () => {
    const commits = parseReleaseCommitHashes('head\nprevious\nolder\n')
    expect(resolveBaselineReleaseCommit(commits, 'head')).toBe('previous')
  })

  it('marks first release as deploying both website and app', () => {
    const plan = createReleasePlan({
      baselineCommit: null,
      changedFiles: [],
      currentVersion: '2.1.0',
      headCommit: 'head',
      previousVersion: null,
    })

    expect(plan.website.required).toBe(true)
    expect(plan.app.required).toBe(true)
    expect(plan.waitForNpm.required).toBe(true)
  })

  it('deploys website and app when shared web source changed', () => {
    const plan = createReleasePlan({
      baselineCommit: 'prev',
      changedFiles: ['packages/web/src/components/dashboard.tsx'],
      currentVersion: '2.1.0',
      headCommit: 'head',
      previousVersion: '2.1.0',
    })

    expect(plan.website.required).toBe(true)
    expect(plan.app.required).toBe(true)
    expect(plan.waitForNpm.required).toBe(false)
  })

  it('deploys only the app when the published CLI version changed', () => {
    const plan = createReleasePlan({
      baselineCommit: 'prev',
      changedFiles: ['packages/cli/src/cli.ts'],
      currentVersion: '2.2.0',
      headCommit: 'head',
      previousVersion: '2.1.0',
    })

    const steps = createReleaseStepDefinitions(plan)

    expect(plan.website.required).toBe(false)
    expect(plan.app.required).toBe(true)
    expect(plan.waitForNpm.required).toBe(true)
    expect(steps.find((step) => step.id === 'deploy-website')?.skipReason).toContain('No website')
  })

  it('reads version from package.json content', () => {
    expect(readPackageVersionFromJson('{"name":"openspecui","version":"2.0.2"}')).toBe('2.0.2')
  })
})
