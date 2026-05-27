import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

describe('ctranslate2 package shape', () => {
  it('exports a Ct2Translator constructor type', async () => {
    const mod = await import('../index.js')
    expect(mod).toHaveProperty('Ct2Translator')
    expect(typeof mod.Ct2Translator).toBe('function')
  })

  it('publishes only ct2 native artifacts', () => {
    const packageJsonPath = join(import.meta.dirname, '..', 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      files?: string[]
      napi?: { binaryName?: string }
    }

    expect(packageJson.napi?.binaryName).toBe('ct2')
    expect(packageJson.files).toContain('ct2.*')
    expect(packageJson.files).not.toContain('*.node')
  })
})
