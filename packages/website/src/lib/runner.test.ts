import { getRunnerCommandPrefix, isRunnerId } from '$lib/runner'
import { describe, expect, it } from 'vitest'

describe('runner helpers', () => {
  it('maps package managers to one-shot command prefixes', () => {
    expect(getRunnerCommandPrefix('npm')).toBe('npx')
    expect(getRunnerCommandPrefix('pnpm')).toBe('pnpx')
    expect(getRunnerCommandPrefix('bun')).toBe('bunx')
  })

  it('validates persisted runner values', () => {
    expect(isRunnerId('npm')).toBe(true)
    expect(isRunnerId('pnpm')).toBe(true)
    expect(isRunnerId('bun')).toBe(true)
    expect(isRunnerId('yarn')).toBe(false)
    expect(isRunnerId(null)).toBe(false)
  })
})
