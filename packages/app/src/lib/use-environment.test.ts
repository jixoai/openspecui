/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Prove environment derivation collapses backends by opaque envUri.
 * 2. Prove capability gating is a pure compatibility fact.
 * 3. Prove connected-project and direct Reference provenance remain source-distinct.
 *
 * Original request (2026-07-15): "app 模式提供了多标签管理。"
 * Section 8.6/9.4/9.5 App environment grouping + capability visibility.
 * Correction request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
import {
  buildBackendHealthPayload,
  type HostedBackendHealthResponse,
  type RootContext,
  type RootContextState,
} from '@openspecui/core'
import { describe, expect, it } from 'vitest'
import {
  type BackendRootContextObservation,
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

function rootObservation(options: {
  tabId: string
  generation: number
  health: HostedBackendHealthResponse
  rootContext: RootContextState | null
}): BackendRootContextObservation {
  const apiBaseUrl = 'http://localhost:3100'
  const source = {
    tabId: options.tabId,
    sessionId: `session-${options.tabId}`,
    generation: options.generation,
    apiBaseUrl,
    tabCreatedAt: 1,
    health: options.health,
    observedAt: options.rootContext?.observedAt ?? 1,
  }
  const rootError = options.rootContext?.state === 'error' ? options.rootContext.error : null
  return {
    evidence:
      options.rootContext && options.rootContext.state !== 'loading' && options.rootContext.data
        ? { ...source, rootContext: options.rootContext }
        : null,
    attempt: {
      ...source,
      status: options.rootContext?.state ?? 'idle',
      error: rootError
        ? { source: 'root-context', code: rootError.code, message: rootError.message }
        : null,
    },
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

  it('deduplicates connected projects by normalized backend locator without merging tab authority', () => {
    const envs = deriveEnvironments([
      {
        tabId: 'first-generation',
        generation: 11,
        apiBaseUrl: 'http://localhost:3100/',
        health: health('openspecui-env://1/aaa', [], 'project-a', 'http://localhost:3100'),
      },
      {
        tabId: 'second-generation',
        generation: 12,
        apiBaseUrl: 'http://localhost:3100',
        health: health('openspecui-env://1/aaa', [], 'project-a', 'http://localhost:3100'),
      },
    ])

    expect(envs).toHaveLength(1)
    expect(envs[0]?.connectedProjects).toHaveLength(1)
    expect(envs[0]?.connectedProjects[0]).toMatchObject({
      apiBaseUrl: 'http://localhost:3100',
      projectName: 'project-a',
    })
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
      rootObservation({
        tabId: 'a',
        generation: 1,
        health: health('openspecui-env://1/aaa', ['contexts.inspect']),
        rootContext,
      }),
    ])
    expect(contexts).toHaveLength(1)
    const ctx = contexts[0]
    if (!ctx?.evidence) throw new Error('Project Root evidence is unavailable.')
    expect(ctx.evidence.storeId).toBe('owned')
    expect(ctx.evidence.references).toMatchObject([
      {
        storeId: 'team',
        root: '/stores/team',
        source: {
          tabId: 'a',
          sessionId: 'session-a',
          generation: 1,
          apiBaseUrl: 'http://localhost:3100',
          tabCreatedAt: 1,
          health: { envUri: 'openspecui-env://1/aaa' },
          observedAt: 1,
        },
        diagnostics: [],
        state: 'observed',
      },
      {
        storeId: 'broken',
        root: '/stores/broken',
        source: {
          tabId: 'a',
          sessionId: 'session-a',
          generation: 1,
          apiBaseUrl: 'http://localhost:3100',
          tabCreatedAt: 1,
          health: { envUri: 'openspecui-env://1/aaa' },
          observedAt: 1,
        },
        diagnostics: [{ severity: 'error', code: 'x', message: 'unresolved' }],
        state: 'error',
        note: 'unresolved',
      },
    ])
  })

  it('skips backends without an envUri and never claims machine-wide completeness', () => {
    const contexts = deriveProjectContexts([
      rootObservation({
        tabId: 'a',
        generation: 1,
        health: health(undefined, []),
        rootContext: null,
      }),
    ])
    expect(contexts).toEqual([])
  })

  it('preserves warning severity, code, message, root, and source without a healthy rewrite', () => {
    const contexts = deriveProjectContexts([
      rootObservation({
        tabId: 'warning-tab',
        generation: 7,
        health: health('openspecui-env://1/aaa', [], 'project-a'),
        rootContext: {
          state: 'ready',
          data: rootData({
            storeId: 'owned',
            references: [
              {
                store_id: 'warning-store',
                root: '/stores/warning-store',
                status: [
                  {
                    severity: 'warning',
                    code: 'reference-warning',
                    message: 'Reference requires attention.',
                  },
                ],
              },
            ],
          }),
          attempt: null,
          error: null,
          observedAt: 1,
        },
      }),
    ])

    expect(contexts[0]?.evidence?.references[0]).toMatchObject({
      storeId: 'warning-store',
      root: '/stores/warning-store',
      source: {
        tabId: 'warning-tab',
        sessionId: 'session-warning-tab',
        generation: 7,
        apiBaseUrl: 'http://localhost:3100',
        tabCreatedAt: 1,
        health: { envUri: 'openspecui-env://1/aaa' },
        observedAt: 1,
      },
      diagnostics: [
        {
          severity: 'warning',
          code: 'reference-warning',
          message: 'Reference requires attention.',
        },
      ],
      state: 'warning',
      note: 'Reference requires attention.',
    })
  })
})
