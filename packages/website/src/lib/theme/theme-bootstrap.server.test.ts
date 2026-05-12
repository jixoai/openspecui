import { websiteThemeBootstrapScript } from '$lib/theme/theme-bootstrap.server'
import { describe, expect, it } from 'vitest'

describe('websiteThemeBootstrapScript', () => {
  it('sets the dark class before the Svelte client hydrates', () => {
    expect(websiteThemeBootstrapScript).toContain('<script>')
    expect(websiteThemeBootstrapScript).toContain("const storageKey = 'theme'")
    expect(websiteThemeBootstrapScript).toContain("root.classList.toggle('dark'")
    expect(websiteThemeBootstrapScript).toContain('root.style.colorScheme')
  })
})
