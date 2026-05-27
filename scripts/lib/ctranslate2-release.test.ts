import { describe, expect, it } from 'vitest'

import { getCt2ReleaseTargets } from './ctranslate2-release'

describe('getCt2ReleaseTargets', () => {
  it('derives the GitHub Actions matrix from the ct2 NAPI config', () => {
    const targets = getCt2ReleaseTargets()

    expect(targets).toEqual([
      expect.objectContaining({
        artifactFileName: 'ct2.linux-x64-gnu.node',
        platformArchAbi: 'linux-x64-gnu',
        runner: 'ubuntu-24.04',
        target: 'x86_64-unknown-linux-gnu',
      }),
      expect.objectContaining({
        artifactFileName: 'ct2.win32-x64-msvc.node',
        platformArchAbi: 'win32-x64-msvc',
        runner: 'windows-2022',
        target: 'x86_64-pc-windows-msvc',
      }),
      expect.objectContaining({
        artifactFileName: 'ct2.darwin-x64.node',
        platformArchAbi: 'darwin-x64',
        runner: 'macos-13',
        target: 'x86_64-apple-darwin',
      }),
      expect.objectContaining({
        artifactFileName: 'ct2.darwin-arm64.node',
        platformArchAbi: 'darwin-arm64',
        runner: 'macos-14',
        target: 'aarch64-apple-darwin',
      }),
    ])
  })
})
