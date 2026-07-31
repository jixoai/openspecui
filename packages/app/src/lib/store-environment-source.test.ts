/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Prove Store Environment sources preserve backend-issued identity and exact connection generation.
 * 2. Prove source projection is independent from the globally active Workspace tab.
 *
 * Original request (2026-07-30): "弱化端口这个概念，重点强调 path的概念。"
 */
import type { HostedBackendHealthResponse } from '@openspecui/core/hosted-contract'
import { describe, expect, it } from 'vitest'
import type { ConnectionObservation } from './connection-observation'
import {
  projectEnvironmentSources,
  projectStoresEnvironmentEvidence,
} from './store-environment-source'

const HEALTH = {
  status: 'ok',
  projectDir: '/work/team',
  projectName: 'team',
  watcherEnabled: true,
  openspecuiVersion: '6.0.1',
  hostedShellProtocolVersion: 1,
  embeddedUiUrl: 'http://127.0.0.1:4100',
  runtimeCapabilities: [],
  cliVersion: '1.6.0',
  envUri: 'openspecui-env://host/data',
  hostedCapabilities: ['stores.inspect', 'stores.mutate', 'stores.content.inspect'],
} satisfies HostedBackendHealthResponse

function observation(): ConnectionObservation {
  return {
    tabId: 'not-active-tab',
    sessionId: 'session-a',
    apiBaseUrl: 'http://127.0.0.1:4100',
    tabCreatedAt: 12,
    generation: 7,
    reachability: 'online',
    health: HEALTH,
    healthError: null,
    rootEvidence: null,
    rootAttempt: {
      tabId: 'not-active-tab',
      sessionId: 'session-a',
      apiBaseUrl: 'http://127.0.0.1:4100',
      tabCreatedAt: 12,
      generation: 7,
      health: HEALTH,
      status: 'loading',
      error: null,
      observedAt: 100,
    },
    current: true,
    stale: false,
    observedAt: 100,
  }
}

describe('Store Environment source projection', () => {
  it('preserves the full exact source while product identity remains envUri', () => {
    expect(projectEnvironmentSources([observation()])).toEqual([
      {
        envUri: 'openspecui-env://host/data',
        tabId: 'not-active-tab',
        sessionId: 'session-a',
        apiBaseUrl: 'http://127.0.0.1:4100',
        tabCreatedAt: 12,
        generation: 7,
        reachability: 'online',
        compatible: true,
      },
    ])
  })

  it('projects project and CLI facts without displaying the locator as Environment identity', () => {
    const evidence = projectStoresEnvironmentEvidence([observation()])
    expect(evidence[0]?.envUri).toBe('openspecui-env://host/data')
    expect(evidence[0]?.projects[0]).toMatchObject({
      sourceId: 'not-active-tab',
      label: 'team',
      cliVersion: '1.6.0',
    })
  })
})
