/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Adapt typed OPSX lifecycle Push/Pull, file-native schema, and artifact projections to React.
 * 2. Let routes defer expensive aggregate Status and Config subscriptions until primary content is renderable.
 * 3. Keep browser cache identity equal to the typed CLI selector across prefetch and route remounts.
 * 4. Keep optional Change, Schema, and artifact selectors from issuing unrelated projection work.
 * 5. Expose Status, Config Bundle, Status List, and Archive Instructions authority to mutation surfaces.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 * Original request (2026-07-26): "展开全面的接口升级和内核升级和测试升级。"
 * Original request (2026-07-28): live Kanban operations require current Status projection authority.
 *
 * Compromise: these OPSX hooks remain in one physical module because routes already consume this public
 * adapter surface; splitting every entity hook during the loading fix would create unrelated import churn.
 */
import type {
  ApplyInstructions,
  ArchiveInstructions,
  ArtifactInstructions,
  ChangeFile,
  ChangeStatus,
  SchemaDetail,
  SchemaInfo,
  SchemaResolution,
  TemplatesMap,
} from '@openspecui/core'
import type { PlanningCliProjectionData } from '@openspecui/core/planning-cli-projection'
import { useCallback } from 'react'
import * as StaticProvider from './static-data-provider'
import { trpcClient } from './trpc'
import {
  useCliProjectionSubscription,
  type CliProjectionSubscriptionState,
} from './use-cli-projection'
import { useSubscription, type SubscriptionState } from './use-subscription'

export interface OpsxTemplateContent {
  content: string | null
  path: string
  displayPath?: string
  source: 'project' | 'user' | 'package'
}

export type OpsxTemplateContentMap = Record<string, OpsxTemplateContent>

interface OpsxStatusInput {
  change?: string
  schema?: string
}

interface OpsxInstructionsInput {
  change?: string
  artifact?: string
  schema?: string
}

export interface OpsxConfigBundle {
  schemas: SchemaInfo[]
  schemaDetails: Record<string, SchemaDetail | null>
  schemaResolutions: Record<string, SchemaResolution | null>
}

export function getOpsxStatusSubscriptionCacheKey(input: OpsxStatusInput): string | undefined {
  if (!input.change) return undefined
  return `opsx.subscribeStatus:${input.change}:${input.schema}`
}

export function useOpsxStatusSubscription(
  input: OpsxStatusInput
): CliProjectionSubscriptionState<ChangeStatus | null> {
  const state = useCliProjectionSubscription<ChangeStatus | null>({
    selector: {
      kind: 'opsx-status',
      change: input.change ?? '__inactive__',
      schema: input.schema,
    },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-status') {
        throw new Error(`Expected opsx-status projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: () => StaticProvider.getOpsxStatus(input.change, input.schema),
    cacheKey: getOpsxStatusSubscriptionCacheKey(input) ?? 'opsx.status:inactive',
    enabled: Boolean(input.change),
  })
  return input.change ? state : { ...state, data: null, isLoading: false }
}

export function useOpsxInstructionsSubscription(
  input: OpsxInstructionsInput
): SubscriptionState<ArtifactInstructions | null> {
  const enabled = Boolean(input.change && input.artifact)
  const state = useCliProjectionSubscription<ArtifactInstructions | null>({
    selector: {
      kind: 'opsx-instructions',
      change: input.change ?? '__inactive__',
      artifact: input.artifact ?? '__inactive__',
      schema: input.schema,
    },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-instructions') {
        throw new Error(`Expected opsx-instructions projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: async () => null,
    cacheKey: enabled
      ? `opsx.subscribeInstructions:${input.change}:${input.artifact}:${input.schema}`
      : 'opsx.instructions:inactive',
    enabled,
  })
  return enabled ? state : { ...state, data: null, isLoading: false }
}

/** Subscribe to the aggregate config projection only after its owning route admits the work. */
export function useOpsxConfigBundleSubscription(
  enabled = true
): CliProjectionSubscriptionState<OpsxConfigBundle> {
  return useCliProjectionSubscription<OpsxConfigBundle>({
    selector: { kind: 'opsx-config-bundle' },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-config-bundle') {
        throw new Error(`Expected opsx-config-bundle projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: StaticProvider.getOpsxConfigBundle,
    cacheKey: 'opsx.subscribeConfigBundle',
    enabled,
  })
}

/** Subscribe to all Change statuses only after the route's primary projection is renderable. */
export function useOpsxStatusListSubscription(
  enabled = true
): CliProjectionSubscriptionState<ChangeStatus[]> {
  return useCliProjectionSubscription<ChangeStatus[]>({
    selector: { kind: 'opsx-status-list' },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-status-list') {
        throw new Error(`Expected opsx-status-list projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: StaticProvider.getOpsxStatusList,
    cacheKey: 'opsx.subscribeStatusList',
    enabled,
  })
}

export function useOpsxTemplatesSubscription(
  schema?: string
): SubscriptionState<TemplatesMap | null> {
  return useCliProjectionSubscription<TemplatesMap | null>({
    selector: { kind: 'opsx-templates', schema },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-templates') {
        throw new Error(`Expected opsx-templates projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: () => StaticProvider.getOpsxTemplates(schema),
    cacheKey: `opsx.subscribeTemplates:${schema ?? ''}`,
  })
}

export function useOpsxSchemaYamlSubscription(name?: string): SubscriptionState<string | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: string | null) => void; onError: (err: Error) => void }) => {
      if (!name) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeSchemaYaml.subscribe(
        { name },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [name]
  )

  return useSubscription<string | null>(
    subscribe,
    () => StaticProvider.getOpsxSchemaYaml(name),
    [name],
    name ? `opsx.subscribeSchemaYaml:${name}` : undefined
  )
}

export function useOpsxSchemaFilesSubscription(
  name?: string
): SubscriptionState<ChangeFile[] | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: ChangeFile[] | null) => void; onError: (err: Error) => void }) => {
      if (!name) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeSchemaFiles.subscribe(
        { name },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [name]
  )

  return useSubscription<ChangeFile[] | null>(
    subscribe,
    () => StaticProvider.getOpsxSchemaFiles(name),
    [name],
    name ? `opsx.subscribeSchemaFiles:${name}` : undefined
  )
}

export function useOpsxTemplateContentSubscription(
  schema?: string,
  artifactId?: string
): SubscriptionState<OpsxTemplateContent | null> {
  const enabled = Boolean(schema && artifactId)
  const state = useCliProjectionSubscription<OpsxTemplateContent | null>({
    selector: { kind: 'opsx-template-contents', schema },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-template-contents') {
        throw new Error(`Expected opsx-template-contents projection, received ${data.kind}.`)
      }
      return artifactId ? (data.value[artifactId] ?? null) : null
    },
    staticLoader: () => StaticProvider.getOpsxTemplateContent(schema, artifactId),
    cacheKey: enabled
      ? `opsx.subscribeTemplateContent:${schema}:${artifactId}`
      : 'opsx.template-content:inactive',
    enabled,
  })
  return enabled ? state : { ...state, data: null, isLoading: false }
}

export function useOpsxTemplateContentsSubscription(
  schema?: string
): SubscriptionState<OpsxTemplateContentMap | null> {
  return useCliProjectionSubscription<OpsxTemplateContentMap | null>({
    selector: { kind: 'opsx-template-contents', schema },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-template-contents') {
        throw new Error(`Expected opsx-template-contents projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: () => StaticProvider.getOpsxTemplateContents(schema),
    cacheKey: `opsx.subscribeTemplateContents:${schema ?? ''}`,
  })
}

export function useOpsxApplyInstructionsSubscription(input: {
  change?: string
  schema?: string
}): SubscriptionState<ApplyInstructions | null> {
  const enabled = Boolean(input.change)
  const state = useCliProjectionSubscription<ApplyInstructions | null>({
    selector: {
      kind: 'opsx-apply-instructions',
      change: input.change ?? '__inactive__',
      schema: input.schema,
    },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-apply-instructions') {
        throw new Error(`Expected opsx-apply-instructions projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: async () => null,
    cacheKey: enabled
      ? `opsx.subscribeApplyInstructions:${input.change}:${input.schema}`
      : 'opsx.apply-instructions:inactive',
    enabled,
  })
  return enabled ? state : { ...state, data: null, isLoading: false }
}

export function useOpsxArchiveInstructionsSubscription(input: {
  change?: string
  schema?: string
}): CliProjectionSubscriptionState<{
  instructions: ArchiveInstructions
  rootGeneration: string
} | null> {
  const enabled = Boolean(input.change)
  const state = useCliProjectionSubscription<{
    instructions: ArchiveInstructions
    rootGeneration: string
  } | null>({
    selector: {
      kind: 'opsx-archive-instructions',
      change: input.change ?? '__inactive__',
      schema: input.schema,
    },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-archive-instructions') {
        throw new Error(`Expected opsx-archive-instructions projection, received ${data.kind}.`)
      }
      return { instructions: data.value, rootGeneration: data.rootGeneration }
    },
    staticLoader: async () => null,
    cacheKey: enabled
      ? `opsx.subscribeArchiveInstructions:${input.change}:${input.schema}`
      : 'opsx.archive-instructions:inactive',
    enabled,
  })
  return enabled ? state : { ...state, data: null, isLoading: false }
}

export function useOpsxChangeListSubscription(): SubscriptionState<string[]> {
  return useCliProjectionSubscription<string[]>({
    selector: { kind: 'opsx-change-list' },
    selectData(data: PlanningCliProjectionData) {
      if (data.kind !== 'opsx-change-list') {
        throw new Error(`Expected opsx-change-list projection, received ${data.kind}.`)
      }
      return data.value
    },
    staticLoader: StaticProvider.getOpsxChangeList,
    cacheKey: 'opsx.changeList',
  })
}

export function useOpsxArtifactOutputSubscription(
  changeId?: string,
  outputPath?: string
): SubscriptionState<string | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: string | null) => void; onError: (err: Error) => void }) => {
      if (!changeId || !outputPath) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeArtifactOutput.subscribe(
        { changeId, outputPath },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [changeId, outputPath]
  )

  return useSubscription<string | null>(
    subscribe,
    () => StaticProvider.getOpsxArtifactOutput(changeId, outputPath),
    [changeId, outputPath],
    changeId && outputPath ? `opsx.subscribeArtifactOutput:${changeId}:${outputPath}` : undefined
  )
}

export interface GlobArtifactFile {
  path: string
  type: 'file'
  content: string
}

export function useOpsxGlobArtifactFilesSubscription(
  changeId?: string,
  outputPath?: string
): SubscriptionState<GlobArtifactFile[]> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: GlobArtifactFile[]) => void; onError: (err: Error) => void }) => {
      if (!changeId || !outputPath) {
        callbacks.onData([])
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeGlobArtifactFiles.subscribe(
        { changeId, outputPath },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [changeId, outputPath]
  )

  return useSubscription<GlobArtifactFile[]>(
    subscribe,
    () => StaticProvider.getOpsxGlobArtifactFiles(changeId, outputPath),
    [changeId, outputPath],
    changeId && outputPath ? `opsx.subscribeGlobArtifactFiles:${changeId}:${outputPath}` : undefined
  )
}
