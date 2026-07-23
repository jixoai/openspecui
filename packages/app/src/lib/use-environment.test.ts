/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove environment derivation collapses backends by opaque envUri.
 * 2. Prove capability gating is a pure compatibility fact.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 8.6/9.4/9.5 App environment grouping + capability visibility.
 */
import type { HostedBackendHealthResponse } from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import {
  canRenderStoreInspector,
  deriveEnvironments,
  deriveProjectContexts,
} from './use-environment'

function health(envUri: string | undefined, capabilities?: string[]): HostedBackendHealthResponse {
  return {
    status: 'ok',
    projectDir: '/p',
    projectName: 'p',
    watcherEnabled: true,
    openspecuiVersion: '6.0.0',
    hostedShellProtocolVersion: 1,
    embeddedUiUrl: 'http://localhost:3100',
    runtimeCapabilities: ['notifications.subscribe', 'config.notifications'],
    envUri,
    hostedCapabilities: capabilities,
  } as HostedBackendHealthResponse
}

describe('deriveEnvironments', () => {
  it('groups online backends by opaque envUri', () => {
    const envs = deriveEnvironments([
      {
        apiBaseUrl: 'http://localhost:3100',
        health: health('openspecui-env://1/aaa', ['stores.inspect']),
      },
      {
        apiBaseUrl: 'http://localhost:3200',
        health: health('openspecui-env://1/aaa', ['stores.inspect']),
      },
      { apiBaseUrl: 'http://localhost:4100', health: health('openspecui-env://1/bbb', []) },
    ])
    expect(envs).toHaveLength(2)
    const aaa = envs.find((e) => (e.envUri as string) === 'openspecui-env://1/aaa')
    expect(aaa?.capabilities).toEqual(['stores.inspect'])
  })

  it('skips backends whose health omits envUri', () => {
    const envs = deriveEnvironments([
      { apiBaseUrl: 'http://localhost:3100', health: health(undefined, ['stores.inspect']) },
    ])
    expect(envs).toEqual([])
  })

  it('never exposes raw host/data-home values (envUri is opaque)', () => {
    const envs = deriveEnvironments([
      { apiBaseUrl: 'http://localhost:3100', health: health('openspecui-env://1/aaa', []) },
    ])
    const serialized = JSON.stringify(envs)
    expect(serialized).not.toMatch(/\/tmp\/data/)
    expect(serialized).not.toContain('host-a')
  })
})

describe('canRenderStoreInspector', () => {
  it('renders only when stores.inspect is advertised', () => {
    expect(canRenderStoreInspector(['stores.inspect'])).toBe(true)
    expect(canRenderStoreInspector(['stores.mutate'])).toBe(false)
    expect(canRenderStoreInspector(undefined)).toBe(false)
  })
})

describe('deriveProjectContexts', () => {
  it('projects observed references from a ready Root Context without claiming completeness', () => {
    const rootContext = {
      state: 'ready',
      data: {
        planningRoot: { source: 'store', store_id: 'owned' },
        storeId: 'owned',
        references: [
          { store_id: 'team', status: [] },
          {
            store_id: 'broken',
            status: [{ severity: 'error', code: 'x', message: 'unresolved' }],
          },
        ],
      },
    }
    const contexts = deriveProjectContexts([
      {
        apiBaseUrl: 'http://localhost:3100',
        health: health('openspecui-env://1/aaa', ['contexts.inspect']),
        rootContext,
      },
    ])
    expect(contexts).toHaveLength(1)
    const ctx = contexts[0]!
    expect(ctx.storeId).toBe('owned')
    expect(ctx.references).toEqual([
      { storeId: 'team', state: 'healthy', note: undefined },
      { storeId: 'broken', state: 'unhealthy', note: 'unresolved' },
    ])
  })

  it('skips backends without an envUri and never claims machine-wide completeness', () => {
    const contexts = deriveProjectContexts([
      {
        apiBaseUrl: 'http://localhost:3100',
        health: health(undefined, []),
        rootContext: null,
      },
    ])
    expect(contexts).toEqual([])
  })
})
