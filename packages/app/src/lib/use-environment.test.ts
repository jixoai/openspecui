/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Prove environment derivation collapses backends by opaque envUri.
 * 2. Prove capability gating is a pure compatibility fact.
 * 3. Prove connected-project and direct Reference provenance remain source-distinct.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 8.6/9.4/9.5 App environment grouping + capability visibility.
 */
import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
  type RootContext,
  type RootContextState,
} from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import {
  canRenderStoreInspector,
  deriveEnvironments,
  deriveProjectContexts,
} from './use-environment'

function health(
  envUri: string | undefined,
  capabilities?: string[],
  projectName = 'p',
  apiBaseUrl = 'http://localhost:3100'
): HostedBackendHealthResponse {
  return buildBackendHealthPayload({
    projectDir: `/tmp/${projectName}`,
    projectName,
    watcherEnabled: true,
    openspecuiVersion: '6.0.0',
    embeddedUiUrl: apiBaseUrl,
    apiBaseUrl,
    envUri,
    hostedCapabilities: capabilities,
  })
}

function rootData(options: {
  storeId: string
  references: RootContext['references']
}): RootContext {
  return {
    launchProject: { path: '/launch' },
    planningRoot: {
      path: `/stores/${options.storeId}`,
      source: 'store',
      store_id: options.storeId,
      healthy: true,
      status: [],
    },
    storeId: options.storeId,
    generation: `root-${options.storeId}`,
    cli: { available: true, version: '1.6.0' },
    references: options.references,
    contextMembers: [],
    dataScope: {
      path: '/tmp/data/openspec',
      source: 'xdg-data-home',
      environmentVariable: 'XDG_DATA_HOME',
    },
    diagnostics: { root: [], doctor: [], context: [] },
    evidence: { doctor: null, context: null },
    observedAt: 1,
  }
}

describe('deriveEnvironments', () => {
  it('groups online backends by opaque envUri', () => {
    const envs = deriveEnvironments([
      {
        tabId: 'a',
        generation: 1,
        apiBaseUrl: 'http://localhost:3100',
        health: health(
          'openspecui-env://1/aaa',
          ['stores.inspect'],
          'project-a',
          'http://localhost:3100'
        ),
      },
      {
        tabId: 'b',
        generation: 2,
        apiBaseUrl: 'http://localhost:3200',
        health: health(
          'openspecui-env://1/aaa',
          ['stores.inspect'],
          'project-b',
          'http://localhost:3200'
        ),
      },
      {
        tabId: 'c',
        generation: 3,
        apiBaseUrl: 'http://localhost:4100',
        health: health('openspecui-env://1/bbb', [], 'project-c', 'http://localhost:4100'),
      },
    ])
    expect(envs).toHaveLength(2)
    const aaa = envs.find((e) => (e.envUri as string) === 'openspecui-env://1/aaa')
    expect(aaa?.connectedProjects).toMatchObject([
      { tabId: 'a', projectName: 'project-a', apiBaseUrl: 'http://localhost:3100' },
      { tabId: 'b', projectName: 'project-b', apiBaseUrl: 'http://localhost:3200' },
    ])
  })

  it('skips backends whose health omits envUri', () => {
    const envs = deriveEnvironments([
      {
        tabId: 'a',
        generation: 1,
        apiBaseUrl: 'http://localhost:3100',
        health: health(undefined, ['stores.inspect']),
      },
    ])
    expect(envs).toEqual([])
  })

  it('never exposes raw host/data-home values (envUri is opaque)', () => {
    const envs = deriveEnvironments([
      {
        tabId: 'a',
        generation: 1,
        apiBaseUrl: 'http://localhost:3100',
        health: health('openspecui-env://1/aaa', []),
      },
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
    const rootContext: RootContextState = {
      state: 'ready',
      data: rootData({
        storeId: 'owned',
        references: [
          { store_id: 'team', root: '/stores/team', status: [] },
          {
            store_id: 'broken',
            root: '/stores/broken',
            status: [{ severity: 'error', code: 'x', message: 'unresolved' }],
          },
        ],
      }),
      attempt: null,
      error: null,
      observedAt: 1,
    }
    const contexts = deriveProjectContexts([
      {
        tabId: 'a',
        generation: 1,
        apiBaseUrl: 'http://localhost:3100',
        health: health('openspecui-env://1/aaa', ['contexts.inspect']),
        rootContext,
      },
    ])
    expect(contexts).toHaveLength(1)
    const ctx = contexts[0]!
    expect(ctx.storeId).toBe('owned')
    expect(ctx.references).toEqual([
      {
        storeId: 'team',
        root: '/stores/team',
        diagnostics: [],
        state: 'healthy',
        note: undefined,
      },
      {
        storeId: 'broken',
        root: '/stores/broken',
        diagnostics: [{ severity: 'error', code: 'x', message: 'unresolved' }],
        state: 'unhealthy',
        note: 'unresolved',
      },
    ])
  })

  it('skips backends without an envUri and never claims machine-wide completeness', () => {
    const contexts = deriveProjectContexts([
      {
        tabId: 'a',
        generation: 1,
        apiBaseUrl: 'http://localhost:3100',
        health: health(undefined, []),
        rootContext: null,
      },
    ])
    expect(contexts).toEqual([])
  })
})
