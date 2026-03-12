import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { computeCiScope } from './ci-scope.mjs'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

describe('computeCiScope', () => {
  it('skips fast and browser gates for docs-only changes', () => {
    const scope = computeCiScope({ changedFiles: ['README.md', 'openspec/project.md'], rootDir })
    expect(scope.fast.mode).toBe('skip')
    expect(scope.browser.required).toBe(false)
  })

  it('runs reference-only mode for reference updates', () => {
    const scope = computeCiScope({ changedFiles: ['references/openspec/CHANGELOG.md'], rootDir })
    expect(scope.fast.mode).toBe('reference-only')
    expect(scope.fast.runReferenceCheck).toBe(true)
    expect(scope.browser.required).toBe(false)
  })

  it('fans web changes out to cli, app, and website', () => {
    const scope = computeCiScope({ changedFiles: ['packages/web/src/routes/dashboard.tsx'], rootDir })
    expect(scope.fast.mode).toBe('scoped')
    expect(scope.affectedPackages).toEqual(
      expect.arrayContaining(['@openspecui/web', 'openspecui', '@openspecui/app', '@openspecui/website'])
    )
    expect(scope.browser.runWeb).toBe(true)
    expect(scope.browser.runXterm).toBe(false)
  })

  it('fans xterm changes out to web dependents and both browser shards', () => {
    const scope = computeCiScope({ changedFiles: ['packages/xterm-input-panel/src/index.ts'], rootDir })
    expect(scope.affectedPackages).toEqual(
      expect.arrayContaining(['xterm-input-panel', '@openspecui/web', 'openspecui', '@openspecui/app', '@openspecui/website'])
    )
    expect(scope.browser.runWeb).toBe(true)
    expect(scope.browser.runXterm).toBe(true)
  })

  it('treats shared workflow changes as full coverage with browser validation', () => {
    const scope = computeCiScope({ changedFiles: ['.github/workflows/pr-quality.yml'], rootDir })
    expect(scope.fast.mode).toBe('full')
    expect(scope.browser.runWeb).toBe(true)
    expect(scope.browser.runXterm).toBe(true)
  })

  it('treats generic scripts changes as full fast coverage without forced browser shards', () => {
    const scope = computeCiScope({ changedFiles: ['scripts/release-tui.tsx'], rootDir })
    expect(scope.fast.mode).toBe('full')
    expect(scope.browser.runWeb).toBe(false)
    expect(scope.browser.runXterm).toBe(false)
  })
})
