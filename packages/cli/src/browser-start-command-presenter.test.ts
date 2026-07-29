/**
 * Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
 * 1. Prove the Browser presenter materializes Direct Project Web requests.
 * 2. Keep credentials in private URL fragments without reflecting them through opener errors.
 *
 * Original request (2026-07-28): "backend a 会重新打开一个浏览器窗口，而不是聚焦原本的窗口。"
 */
import { describe, expect, it } from 'vitest'
import {
  createBrowserStartCommandPresenter,
  type ProjectWebPresentationRequest,
} from './browser-start-command-presenter.js'

describe('Browser start-command presenter', () => {
  it('opens the private Direct Web target', async () => {
    const targets: string[] = []
    const presenter = createBrowserStartCommandPresenter(async (target) => {
      targets.push(target)
    })

    await presenter.present({
      surface: 'project-web',
      webBaseUrl: 'http://localhost:13100',
      credential: 'browser-secret',
    } satisfies ProjectWebPresentationRequest)

    expect(targets).toHaveLength(1)
    const target = new URL(targets[0] ?? 'invalid:missing-target')
    expect(target.origin).toBe('http://localhost:13100')
    expect(target.searchParams.has('credential')).toBe(false)
    expect(new URLSearchParams(target.hash.slice(1)).get('credential')).toBe('browser-secret')
  })

  it('does not reflect a private target from an external opener failure', async () => {
    const presenter = createBrowserStartCommandPresenter(async (target) => {
      throw new Error(`Unable to open ${target}`)
    })

    const failure = presenter.present({
      surface: 'project-web',
      webBaseUrl: 'http://localhost:13100',
      credential: 'browser-secret',
    })
    await expect(failure).rejects.toThrow('Failed to open Project Web in the system browser.')
    await expect(failure).rejects.not.toThrow('browser-secret')
  })
})
