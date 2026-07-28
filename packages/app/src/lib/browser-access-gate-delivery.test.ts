/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove an App tab forwards only its locator-owned credential into the Project Web iframe fragment.
 * 2. Prove another backend locator never inherits that credential.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import { afterEach, describe, expect, it } from 'vitest'
import { bindLaunchCredential, clearLaunchCredential } from './launch-credential'
import { buildHostedEmbeddedUiUrl, type HostedShellTab } from './shell-state'

const API_A = 'http://localhost:3100'
const API_B = 'http://localhost:3200'

function createTab(apiBaseUrl: string): HostedShellTab {
  return {
    id: `tab-${apiBaseUrl}`,
    sessionId: `session-${apiBaseUrl}`,
    apiBaseUrl,
    createdAt: 1,
  }
}

afterEach(() => {
  clearLaunchCredential(API_A)
  clearLaunchCredential(API_B)
})

describe('Project Web iframe Access Gate delivery', () => {
  it('binds the exact locator credential to only the matching iframe fragment', () => {
    bindLaunchCredential(API_A, 'credential-a')

    const iframeA = new URL(buildHostedEmbeddedUiUrl(createTab(API_A), `${API_A}/dashboard`))
    const iframeB = new URL(buildHostedEmbeddedUiUrl(createTab(API_B), `${API_B}/dashboard`))

    expect(new URLSearchParams(iframeA.hash.slice(1)).get('credential')).toBe('credential-a')
    expect(iframeA.searchParams.get('api')).toBe(API_A)
    expect(iframeB.hash).toBe('')
  })
})
