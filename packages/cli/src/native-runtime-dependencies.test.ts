import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CLI_NATIVE_RUNTIME_DEPENDENCIES } from './native-runtime-dependencies.js'

interface PackageJson {
  dependencies?: Record<string, string>
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(
  readFileSync(resolve(__dirname, '../package.json'), 'utf-8')
) as PackageJson

describe('CLI native runtime dependencies', () => {
  it('keeps native bindings available as installed runtime dependencies', () => {
    for (const dependency of CLI_NATIVE_RUNTIME_DEPENDENCIES) {
      expect(packageJson.dependencies).toHaveProperty(dependency)
    }
  })
})
