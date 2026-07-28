/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove the Browser presenter materializes semantic Direct Web and hosted App requests.
 * 2. Keep credentials in private URL fragments rather than query state.
 *
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 */
import { describe, expect, it } from 'vitest'
import { createBrowserStartCommandPresenter } from './browser-start-command-presenter.js'
import type { StartCommandPresentationRequest } from './start-command-presentation.js'

describe('Browser start-command presenter', () => {
  it.each([
    {
      name: 'Direct Web',
      request: {
        surface: 'project-web',
        webBaseUrl: 'http://localhost:13100',
        credential: 'browser-secret',
      } satisfies StartCommandPresentationRequest,
      expectedOrigin: 'http://localhost:13100',
      expectedApi: null,
    },
    {
      name: 'hosted App',
      request: {
        surface: 'hosted-app',
        appBaseUrl: 'https://app.openspecui.example/workspace',
        apiBaseUrl: 'http://localhost:13100',
        credential: 'browser-secret',
      } satisfies StartCommandPresentationRequest,
      expectedOrigin: 'https://app.openspecui.example',
      expectedApi: 'http://localhost:13100',
    },
  ])('opens the private $name target', async (testCase) => {
    const targets: string[] = []
    const presenter = createBrowserStartCommandPresenter(async (target) => {
      targets.push(target)
    })

    await presenter.present(testCase.request)

    expect(targets).toHaveLength(1)
    const target = new URL(targets[0] ?? 'invalid:missing-target')
    expect(target.origin).toBe(testCase.expectedOrigin)
    expect(target.searchParams.get('api')).toBe(testCase.expectedApi)
    expect(target.searchParams.has('credential')).toBe(false)
    expect(new URLSearchParams(target.hash.slice(1)).get('credential')).toBe('browser-secret')
  })
})
