import { describe, expect, it } from 'vitest'
import { createHostedAppManifest } from './manifest'

describe('createHostedAppManifest', () => {
  it('creates channel roots and compatibility mappings', () => {
    const manifest = createHostedAppManifest({
      generatedAt: '2026-03-08T00:00:00.000Z',
      channels: [
        {
          id: 'latest',
          kind: 'latest',
          selector: 'latest',
          resolvedVersion: '2.1.2',
          major: 2,
          minor: 1,
        },
        {
          id: 'v2.1',
          kind: 'minor',
          selector: '~2.1.0',
          resolvedVersion: '2.1.2',
          major: 2,
          minor: 1,
        },
      ],
    })

    expect(manifest.channels['v2.1']?.shellPath).toBe('/versions/v2.1/')
    expect(manifest.compatibility).toEqual([{ range: '~2.1.0', channel: 'v2.1' }])
    expect(manifest.defaultChannel).toBe('latest')
  })
})
