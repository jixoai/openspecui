/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Prove the production start-command coordinator receives the Server-issued browser credential.
 * 2. Prove its real Direct Web and App opener targets carry that credential only in the fragment.
 *
 * Original request (2026-07-24): "Prove the real CLI start-command browser-target owner."
 */
import { describe, expect, it } from 'vitest'
import type { RunningServer } from './index.js'
import {
  coordinateStartCommandBrowserTarget,
  type StartCommandBrowserTargetDependencies,
} from './start-command-browser-target.js'

const runningServer = {
  url: 'http://localhost:13100',
  port: 13100,
  preferredPort: 13100,
  close: async () => {},
} satisfies RunningServer

describe('CLI start-command browser-target owner', () => {
  it.each([
    {
      name: 'Direct Web',
      hostedBaseUrl: null,
      expectedOrigin: 'http://localhost:13100',
      expectedApi: null,
    },
    {
      name: 'hosted App',
      hostedBaseUrl: 'https://app.openspecui.example/workspace',
      expectedOrigin: 'https://app.openspecui.example',
      expectedApi: 'http://localhost:13100',
    },
  ])('requests the private $name target from the Server credential callback', async (testCase) => {
    const openedTargets: string[] = []
    const publicHostedUrls: Array<string | null> = []
    const dependencies: StartCommandBrowserTargetDependencies = {
      startServer: async (options) => {
        expect(options.open).toBe(false)
        options.onBrowserLaunchCredential?.('start-command-secret')
        return runningServer
      },
      openBrowser: async (target) => {
        openedTargets.push(target)
      },
    }

    await coordinateStartCommandBrowserTarget(
      {
        serverOptions: { projectDir: '/project', password: 'start-command-secret' },
        hostedBaseUrl: testCase.hostedBaseUrl,
        shouldOpen: true,
        onServerReady: ({ publicHostedUrl }) => {
          publicHostedUrls.push(publicHostedUrl)
        },
      },
      dependencies
    )

    expect(openedTargets).toHaveLength(1)
    const openedUrl = new URL(openedTargets[0] ?? 'invalid:missing-target')
    expect(openedUrl.origin).toBe(testCase.expectedOrigin)
    expect(openedUrl.searchParams.get('api')).toBe(testCase.expectedApi)
    expect(openedUrl.searchParams.has('credential')).toBe(false)
    expect(new URLSearchParams(openedUrl.hash.slice(1)).get('credential')).toBe(
      'start-command-secret'
    )
    const publicHostedUrl = publicHostedUrls[0]
    if (publicHostedUrl) {
      expect(publicHostedUrl).not.toContain('start-command-secret')
    } else {
      expect(publicHostedUrl).toBeNull()
    }
  })
})
