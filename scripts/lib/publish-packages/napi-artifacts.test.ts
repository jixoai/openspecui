import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { readNapiArtifactPlan, verifyNapiPublishArtifacts } from './napi-artifacts'

describe('readNapiArtifactPlan', () => {
  it('derives artifact names from napi.config.json targets', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'openspecui-napi-plan-'))
    writeFileSync(
      join(packageDir, 'napi.config.json'),
      JSON.stringify(
        {
          binaryName: 'ct2',
          targets: ['x86_64-unknown-linux-gnu', 'aarch64-apple-darwin'],
        },
        null,
        2
      )
    )

    const plan = readNapiArtifactPlan(packageDir)
    expect(plan?.entries).toEqual([
      {
        artifactFileName: 'ct2.linux-x64-gnu.node',
        platformArchAbi: 'linux-x64-gnu',
        target: 'x86_64-unknown-linux-gnu',
      },
      {
        artifactFileName: 'ct2.darwin-arm64.node',
        platformArchAbi: 'darwin-arm64',
        target: 'aarch64-apple-darwin',
      },
    ])
  })
})

describe('verifyNapiPublishArtifacts', () => {
  it('throws when configured NAPI artifacts are missing', () => {
    const packageDir = mkdtempSync(join(tmpdir(), 'openspecui-napi-verify-'))
    writeFileSync(
      join(packageDir, 'napi.config.json'),
      JSON.stringify(
        {
          binaryName: 'ct2',
          targets: ['x86_64-unknown-linux-gnu', 'x86_64-pc-windows-msvc'],
        },
        null,
        2
      )
    )

    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'ct2.linux-x64-gnu.node'), '')

    expect(() => verifyNapiPublishArtifacts(packageDir)).toThrow(/ct2\.win32-x64-msvc\.node/)
  })
})
