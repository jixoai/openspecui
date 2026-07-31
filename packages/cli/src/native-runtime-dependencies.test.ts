/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Prove required native facades remain installed runtime dependencies.
 * 2. Prove heavyweight translation runtimes remain optional peer dependencies.
 *
 * Original request (2026-07-31): "这个依赖好像会导致安装的时候仍然会被强制装上去，可能要改成 peerDependencies 会更好"
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  CLI_NATIVE_RUNTIME_DEPENDENCIES,
  CLI_OPTIONAL_NATIVE_RUNTIME_PEER_DEPENDENCIES,
} from './native-runtime-dependencies.js'

interface PackageJson {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
) as PackageJson

describe('CLI native runtime dependencies', () => {
  it('keeps required native bindings available as installed runtime dependencies', () => {
    for (const dependency of CLI_NATIVE_RUNTIME_DEPENDENCIES) {
      if (CLI_OPTIONAL_NATIVE_RUNTIME_PEER_DEPENDENCIES.includes(dependency)) {
        continue
      }

      expect(
        dependency in (packageJson.dependencies ?? {}) ||
          dependency in (packageJson.optionalDependencies ?? {})
      ).toBe(true)
    }
  })

  it('keeps heavyweight translation runtimes as optional peers', () => {
    for (const dependency of CLI_OPTIONAL_NATIVE_RUNTIME_PEER_DEPENDENCIES) {
      expect(packageJson.peerDependencies?.[dependency]).toBeDefined()
      expect(packageJson.peerDependenciesMeta?.[dependency]?.optional).toBe(true)
    }
  })
})
