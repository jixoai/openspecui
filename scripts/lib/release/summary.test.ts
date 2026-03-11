import { describe, expect, it } from 'vitest'

import { createReleasePlan } from './plan'
import { formatReleaseOverviewLines, formatReleaseStepStatus } from './summary'

describe('formatReleaseOverviewLines', () => {
  it('includes release decisions and step statuses', () => {
    const plan = createReleasePlan({
      baselineCommit: 'prev',
      changedFiles: ['packages/website/src/main.tsx'],
      currentVersion: '2.1.0',
      headCommit: 'head',
      previousVersion: '2.1.0',
    })
    const lines = formatReleaseOverviewLines(
      plan,
      new Map([
        ['preflight', 'success'],
        ['publish-packages', 'running'],
      ]),
      null
    )

    expect(lines.join('\n')).toContain('Current openspecui version: 2.1.0')
    expect(lines.join('\n')).toContain('- Website: deploy')
    expect(lines.join('\n')).toContain(`[${formatReleaseStepStatus('success')}] Preflight`)
    expect(lines.join('\n')).toContain(`[${formatReleaseStepStatus('running')}] Publish Packages`)
  })
})
