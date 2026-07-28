/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Prove registry-missing versions require publication.
 * 2. Prove registry-complete but tag-missing versions require recovery.
 * 3. Prove a fully delivered version is a true no-op.
 *
 * Original request (2026-07-28): "我想先发布一个beta版本"
 */

import { describe, expect, it } from 'vitest'

import { createPackageReleaseWork } from './release-work'

describe('package release work', () => {
  it('keeps registry publication and tag recovery as separate facts', () => {
    const plan = createPackageReleaseWork([
      { package: 'core', tagExists: false, versionPublished: false },
      { package: 'web', tagExists: false, versionPublished: true },
      { package: 'cli', tagExists: true, versionPublished: true },
    ])

    expect(plan).toEqual({
      missingTags: ['core', 'web'],
      packagesToPublish: ['core'],
      required: true,
    })
  })

  it('requires tag recovery after registry publication has already completed', () => {
    expect(
      createPackageReleaseWork([
        { package: 'openspecui', tagExists: false, versionPublished: true },
      ])
    ).toMatchObject({ packagesToPublish: [], required: true })
  })

  it('reports a true no-op only when registry and tag delivery are complete', () => {
    expect(
      createPackageReleaseWork([{ package: 'openspecui', tagExists: true, versionPublished: true }])
    ).toEqual({ missingTags: [], packagesToPublish: [], required: false })
  })
})
