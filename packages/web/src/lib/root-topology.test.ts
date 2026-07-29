/**
 * Orthogonal intents (created 2026-07-29 Asia/Shanghai):
 * 1. Prove same physical identity collapses even when the display path is a symlink alias.
 * 2. Prove distinct and unresolved roots never collapse from source, Store, warning, or Git-like hints.
 *
 * Owner same-root direction (2026-07-29): collapse only after objective physical identity comparison.
 */
import type { RootContext } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { selectRootTopology } from './root-topology'

function identity(
  launchPath: string,
  planningPath: string | null,
  physicalPath?: string
): Pick<RootContext, 'launchProject' | 'planningRoot'> {
  return {
    launchProject: { path: launchPath, ...(physicalPath ? { physicalPath } : {}) },
    planningRoot: planningPath
      ? { path: planningPath, source: 'nearest', healthy: true, status: [] }
      : null,
  }
}

describe('selectRootTopology', () => {
  it('uses canonical physical identity instead of the display path alias', () => {
    expect(
      selectRootTopology(
        identity('/tmp/project-link', '/private/tmp/project', '/private/tmp/project')
      )
    ).toBe('collapsed')
  })

  it('normalizes server-observed physical separators without using Root provenance as identity', () => {
    expect(
      selectRootTopology(
        identity('/workspace/project-link', '/workspace/project', '/workspace/project/')
      )
    ).toBe('collapsed')
    expect(
      selectRootTopology(identity('/workspace/launch', '/workspace/planning', '/workspace/launch'))
    ).toBe('distinct')
  })

  it('keeps missing current identity unresolved', () => {
    expect(selectRootTopology(null)).toBe('unresolved')
    expect(selectRootTopology(identity('/workspace/launch', null))).toBe('unresolved')
    expect(selectRootTopology(identity('/workspace/project', '/workspace/project'))).toBe(
      'unresolved'
    )
  })
})
