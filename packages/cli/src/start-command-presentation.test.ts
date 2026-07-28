/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Prove the real start coordinator submits a semantic Direct Web or hosted App presentation request.
 * 2. Prove public readiness evidence remains credential-free and `--no-open` skips presentation.
 *
 * Original request (2026-07-28): "从底层上封装，后续可能对接 OpenTray 原生窗口。"
 */
import { describe, expect, it } from 'vitest'
import type { RunningServer } from './index.js'
import {
  coordinateStartCommandPresentation,
  type StartCommandPresentationDependencies,
  type StartCommandPresentationRequest,
} from './start-command-presentation.js'

const runningServer = {
  url: 'http://localhost:13100',
  port: 13100,
  preferredPort: 13100,
  close: async () => {},
} satisfies RunningServer

describe('CLI start-command presentation owner', () => {
  it.each([
    {
      name: 'Direct Web',
      hostedBaseUrl: null,
      expectedRequest: {
        surface: 'project-web',
        webBaseUrl: 'http://localhost:13100',
        credential: 'start-command-secret',
      } satisfies StartCommandPresentationRequest,
    },
    {
      name: 'hosted App',
      hostedBaseUrl: 'https://app.openspecui.example/workspace',
      expectedRequest: {
        surface: 'hosted-app',
        appBaseUrl: 'https://app.openspecui.example/workspace',
        apiBaseUrl: 'http://localhost:13100',
        credential: 'start-command-secret',
      } satisfies StartCommandPresentationRequest,
    },
  ])('submits the private $name intent to the selected presenter', async (testCase) => {
    const requests: StartCommandPresentationRequest[] = []
    const publicHostedUrls: Array<string | null> = []
    const dependencies: StartCommandPresentationDependencies = {
      startServer: async (options) => {
        expect(options.open).toBe(false)
        options.onBrowserLaunchCredential?.('start-command-secret')
        return runningServer
      },
      presenter: {
        present: async (request) => {
          requests.push(request)
        },
      },
    }

    await coordinateStartCommandPresentation(
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

    expect(requests).toEqual([testCase.expectedRequest])
    const publicHostedUrl = publicHostedUrls[0]
    if (publicHostedUrl) {
      expect(publicHostedUrl).not.toContain('start-command-secret')
    } else {
      expect(publicHostedUrl).toBeNull()
    }
  })

  it('does not present a surface when automatic opening is disabled', async () => {
    const requests: StartCommandPresentationRequest[] = []
    await coordinateStartCommandPresentation(
      {
        serverOptions: { projectDir: '/project' },
        hostedBaseUrl: 'https://app.openspecui.example',
        shouldOpen: false,
      },
      {
        startServer: async () => runningServer,
        presenter: {
          present: async (request) => {
            requests.push(request)
          },
        },
      }
    )

    expect(requests).toEqual([])
  })
})
