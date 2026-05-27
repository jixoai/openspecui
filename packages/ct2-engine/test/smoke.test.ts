import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import runtimeSupport from '../runtime-support.js'

const {
  assertSupportedCt2Runtime,
  readSupportedPlatformArchAbis,
  resolveRuntimePlatformArchAbi,
  toPlatformArchAbi,
} = runtimeSupport

describe('ctranslate2 package shape', () => {
  it('publishes a Ct2Translator constructor type declaration', () => {
    const typeEntryPath = join(import.meta.dirname, '..', 'index.d.ts')
    const typeEntry = readFileSync(typeEntryPath, 'utf8')

    expect(typeEntry).toMatch(/export declare class Ct2Translator\b/)
  })

  it('publishes only ct2 native artifacts', () => {
    const packageJsonPath = join(import.meta.dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      files?: string[]
    }
    const supportedTargets = readSupportedPlatformArchAbis(join(import.meta.dirname, '..'))

    expect(packageJson.files).toContain('ct2.*')
    expect(packageJson.files).not.toContain('*.node')
    expect(packageJson.files).toContain('binding.js')
    expect(supportedTargets).toEqual([
      'linux-x64-gnu',
      'win32-x64-msvc',
      'darwin-x64',
      'darwin-arm64',
    ])
  })

  it('derives platform identifiers from NAPI triples and runtime probes', () => {
    expect(toPlatformArchAbi('x86_64-pc-windows-msvc')).toBe('win32-x64-msvc')
    expect(toPlatformArchAbi('aarch64-apple-darwin')).toBe('darwin-arm64')
    expect(
      resolveRuntimePlatformArchAbi({
        arch: 'x64',
        platform: 'linux',
        report: {
          excludeNetwork: false,
          getReport: () => ({ header: { glibcVersionRuntime: '2.39' } }),
        },
      })
    ).toBe('linux-x64-gnu')
  })

  it('fails fast for runtimes outside the declared support matrix', () => {
    expect(() =>
      assertSupportedCt2Runtime(join(import.meta.dirname, '..'), {
        arch: 'arm64',
        platform: 'linux',
        report: {
          excludeNetwork: false,
          getReport: () => ({ header: { glibcVersionRuntime: '2.39' } }),
        },
      })
    ).toThrow(/Unsupported ctranslate2 runtime target: linux-arm64-gnu/)
  })
})
