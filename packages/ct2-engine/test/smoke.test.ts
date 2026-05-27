import { describe, expect, it } from 'vitest'

describe('ctranslate2 package shape', () => {
  it('exports a Ct2Translator constructor type', async () => {
    const mod = await import('../index.js')
    expect(mod).toHaveProperty('Ct2Translator')
    expect(typeof mod.Ct2Translator).toBe('function')
  })
})
