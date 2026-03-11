import { describe, expect, it } from 'vitest'
import { resolveLocalDevBundleRelativePath } from './dev-server'

describe('resolveLocalDevBundleRelativePath', () => {
  it('resolves direct entry and nested SPA paths to index.html', () => {
    expect(resolveLocalDevBundleRelativePath('/versions/latest')).toBe('index.html')
    expect(resolveLocalDevBundleRelativePath('/versions/latest/')).toBe('index.html')
    expect(resolveLocalDevBundleRelativePath('/versions/latest/dashboard')).toBe('index.html')
    expect(resolveLocalDevBundleRelativePath('/versions/latest/changes/add-hosted')).toBe(
      'index.html'
    )
  })

  it('preserves real asset file paths', () => {
    expect(resolveLocalDevBundleRelativePath('/versions/latest/assets/index.js')).toBe(
      'assets/index.js'
    )
    expect(resolveLocalDevBundleRelativePath('/versions/latest/logo.svg')).toBe('logo.svg')
  })
})
