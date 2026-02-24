import type {
  ApplyInstructions,
  ArtifactInstructions,
  ChangeFile,
  ChangeStatus,
  SchemaDetail,
  SchemaInfo,
  SchemaResolution,
  TemplatesMap,
} from '@openspecui/core'
import { useCallback } from 'react'
import * as StaticProvider from './static-data-provider'
import { trpcClient } from './trpc'
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
  refreshKey?: number
}

interface OpsxInstructionsInput {
  change?: string
  artifact?: string
  schema?: string
  refreshKey?: number
}

export interface OpsxConfigBundle {
  schemas: SchemaInfo[]
  schemaDetails: Record<string, SchemaDetail | null>
  schemaResolutions: Record<string, SchemaResolution | null>
}

export function useOpsxStatusSubscription(
  input: OpsxStatusInput
): SubscriptionState<ChangeStatus | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: ChangeStatus | null) => void; onError: (err: Error) => void }) => {
      if (!input.change) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeStatus.subscribe(
        { change: input.change, schema: input.schema },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [input.change, input.schema, input.refreshKey]
  )

  return useSubscription<ChangeStatus | null>(
    subscribe,
    () => StaticProvider.getOpsxStatus(input.change, input.schema),
    [input.change, input.schema, input.refreshKey],
    input.change
      ? `opsx.subscribeStatus:${input.change}:${input.schema}:${input.refreshKey}`
      : undefined
  )
}

export function useOpsxInstructionsSubscription(
  input: OpsxInstructionsInput
): SubscriptionState<ArtifactInstructions | null> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: ArtifactInstructions | null) => void
      onError: (err: Error) => void
    }) => {
      if (!input.change || !input.artifact) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeInstructions.subscribe(
        { change: input.change, artifact: input.artifact, schema: input.schema },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [input.change, input.artifact, input.schema, input.refreshKey]
  )

  return useSubscription<ArtifactInstructions | null>(
    subscribe,
    async () => null,
    [input.change, input.artifact, input.schema, input.refreshKey],
    input.change && input.artifact
      ? `opsx.subscribeInstructions:${input.change}:${input.artifact}:${input.schema}:${input.refreshKey}`
      : undefined
  )
}

export function useOpsxConfigBundleSubscription(): SubscriptionState<OpsxConfigBundle> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: OpsxConfigBundle) => void; onError: (err: Error) => void }) =>
      trpcClient.opsx.subscribeConfigBundle.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<OpsxConfigBundle>(
    subscribe,
    StaticProvider.getOpsxConfigBundle,
    [],
    'opsx.subscribeConfigBundle'
  )
}

export function useOpsxStatusListSubscription(): SubscriptionState<ChangeStatus[]> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: ChangeStatus[]) => void; onError: (err: Error) => void }) =>
      trpcClient.opsx.subscribeStatusList.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<ChangeStatus[]>(
    subscribe,
    StaticProvider.getOpsxStatusList,
    [],
    'opsx.subscribeStatusList'
  )
}

export function useOpsxTemplatesSubscription(
  schema?: string
): SubscriptionState<TemplatesMap | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: TemplatesMap) => void; onError: (err: Error) => void }) =>
      trpcClient.opsx.subscribeTemplates.subscribe(schema ? { schema } : undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    [schema]
  )

  return useSubscription<TemplatesMap | null>(
    subscribe,
    () => StaticProvider.getOpsxTemplates(schema),
    [schema],
    `opsx.subscribeTemplates:${schema ?? ''}`
  )
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
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: OpsxTemplateContent | null) => void
      onError: (err: Error) => void
    }) => {
      if (!schema || !artifactId) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeTemplateContent.subscribe(
        { schema, artifactId },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [schema, artifactId]
  )

  return useSubscription<OpsxTemplateContent | null>(
    subscribe,
    () => StaticProvider.getOpsxTemplateContent(schema, artifactId),
    [schema, artifactId],
    schema && artifactId ? `opsx.subscribeTemplateContent:${schema}:${artifactId}` : undefined
  )
}

export function useOpsxTemplateContentsSubscription(
  schema?: string
): SubscriptionState<OpsxTemplateContentMap | null> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: OpsxTemplateContentMap | null) => void
      onError: (err: Error) => void
    }) =>
      trpcClient.opsx.subscribeTemplateContents.subscribe(schema ? { schema } : undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    [schema]
  )

  return useSubscription<OpsxTemplateContentMap | null>(
    subscribe,
    () => StaticProvider.getOpsxTemplateContents(schema),
    [schema],
    `opsx.subscribeTemplateContents:${schema ?? ''}`
  )
}

export function useOpsxApplyInstructionsSubscription(input: {
  change?: string
  schema?: string
  refreshKey?: number
}): SubscriptionState<ApplyInstructions | null> {
  const subscribe = useCallback(
    (callbacks: {
      onData: (data: ApplyInstructions | null) => void
      onError: (err: Error) => void
    }) => {
      if (!input.change) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeApplyInstructions.subscribe(
        { change: input.change, schema: input.schema },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [input.change, input.schema, input.refreshKey]
  )

  return useSubscription<ApplyInstructions | null>(
    subscribe,
    async () => null,
    [input.change, input.schema, input.refreshKey],
    input.change
      ? `opsx.subscribeApplyInstructions:${input.change}:${input.schema}:${input.refreshKey}`
      : undefined
  )
}

export function useOpsxProjectConfigSubscription(): SubscriptionState<string | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: string | null) => void; onError: (err: Error) => void }) =>
      trpcClient.opsx.subscribeProjectConfig.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<string | null>(
    subscribe,
    StaticProvider.getOpsxProjectConfig,
    [],
    'opsx.subscribeProjectConfig'
  )
}

export function useOpsxChangeListSubscription(): SubscriptionState<string[]> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: string[]) => void; onError: (err: Error) => void }) =>
      trpcClient.opsx.subscribeChanges.subscribe(undefined, {
        onData: callbacks.onData,
        onError: callbacks.onError,
      }),
    []
  )

  return useSubscription<string[]>(
    subscribe,
    StaticProvider.getOpsxChangeList,
    [],
    'opsx.subscribeChanges'
  )
}

export function useOpsxChangeMetadataSubscription(
  changeId?: string
): SubscriptionState<string | null> {
  const subscribe = useCallback(
    (callbacks: { onData: (data: string | null) => void; onError: (err: Error) => void }) => {
      if (!changeId) {
        callbacks.onData(null)
        return { unsubscribe: () => {} }
      }
      return trpcClient.opsx.subscribeChangeMetadata.subscribe(
        { changeId },
        {
          onData: callbacks.onData,
          onError: callbacks.onError,
        }
      )
    },
    [changeId]
  )

  return useSubscription<string | null>(
    subscribe,
    () => StaticProvider.getOpsxChangeMetadata(changeId),
    [changeId],
    changeId ? `opsx.subscribeChangeMetadata:${changeId}` : undefined
  )
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
