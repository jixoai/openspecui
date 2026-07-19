/**
 * Orthogonal intents (created 2026-07-19 Asia/Shanghai):
 * 1. Provide a type-checked Planning-root resolver for router tests that do not exercise root work.
 * 2. Keep the resolver contract explicit as it evolves without fabricating Launch-owned provenance.
 *
 * Original request (2026-07-19): "代码已经提交，开始review。如果有问题，那么可更新change。"
 */
import type { CliStreamHandle, RootContextResolvedState } from '@openspecui/core'
import type {
  PlanningRootOperation,
  PlanningRootServiceResolver,
  PlanningRootStreamOperation,
} from '../planning-root-service.js'
import type { SchemaMutationAction } from '../schema-mutation-service.js'

function unavailable(): never {
  throw new Error('Planning-root services are unavailable in this router fixture.')
}

/** Build a checked resolver for procedures whose tests do not touch Planning-root state. */
export function createUnavailablePlanningRootServices(): PlanningRootServiceResolver {
  return {
    resolveRootContext: async (): Promise<RootContextResolvedState> => unavailable(),
    resolveRootContextReactive: async (): Promise<RootContextResolvedState> => unavailable(),
    runOperation: async <T>(_operation: PlanningRootOperation<T>): Promise<T> => unavailable(),
    runReactiveOperation: async <T>(_operation: PlanningRootOperation<T>): Promise<T> =>
      unavailable(),
    startOperationStream: async (
      _operation: PlanningRootStreamOperation
    ): Promise<CliStreamHandle> => unavailable(),
    mutateSchema: async (_action: SchemaMutationAction) => unavailable(),
    readPreviewRequest: () => unavailable(),
    dispose: async () => unavailable(),
  }
}
