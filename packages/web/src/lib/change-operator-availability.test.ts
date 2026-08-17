/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Prove Apply prerequisites accept dependency-satisfied skipped artifacts.
 * 2. Keep skipped satisfaction independent from physical output existence.
 *
 * Original request (2026-08-01): adapt OpenSpec 1.7 skipped artifact semantics without fabricating files.
 */
import type { ChangeStatus } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import { getChangeApplyAvailability } from './change-operator-availability'

function status(artifactStatus: 'done' | 'skipped' | 'ready' | 'blocked'): ChangeStatus {
  return {
    changeName: 'skip-specs',
    schemaName: 'spec-driven',
    isPlanningComplete: false,
    applyRequires: ['specs'],
    artifacts: [
      {
        id: 'specs',
        outputPath: 'specs/**/*.md',
        status: artifactStatus,
        requires: ['proposal'],
      },
    ],
    provenance: { kind: 'static' },
  }
}

describe('getChangeApplyAvailability', () => {
  it('accepts a skipped required artifact without a physical relative path', () => {
    const changeStatus = status('skipped')

    expect(changeStatus.artifacts[0]).not.toHaveProperty('relativePath')
    expect(getChangeApplyAvailability(changeStatus)).toEqual({
      available: true,
      missingArtifactIds: [],
    })
  })

  it('keeps ready and blocked required artifacts unavailable', () => {
    expect(getChangeApplyAvailability(status('ready'))).toEqual({
      available: false,
      missingArtifactIds: ['specs'],
    })
    expect(getChangeApplyAvailability(status('blocked'))).toEqual({
      available: false,
      missingArtifactIds: ['specs'],
    })
  })
})
