/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Publish the supported Server package surface.
 * 2. Publish the Change Detail diff-evidence projection types for type-only Web consumption.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
export {
  checkWebSocketConnectionParams,
  createAccessGate,
  createAccessGateMiddleware,
  extractBearerCredential,
  isLoopbackHostname,
  type AccessGate,
} from './access-gate.js'
export type {
  ChangeDiffEvidence,
  ChangeDiffEvidenceDelta,
  ChangeDiffEvidenceProvenance,
} from './change-diff-evidence-service.js'
export { DocumentService, type ReadSpecDocumentResult } from './document-service.js'
export {
  OPENSPECUI_HOOKS_RELATIVE_PATH,
  ProjectHookRuntime,
  createHookRuntime,
  type HookRuntime,
} from './hook-runtime.js'
export { LocalModelAssetService } from './local-model-asset-service.js'
export { findAvailablePort, isPortAvailable } from './port-utils.js'
export { type AppRouter, type Context, type GitWorktreeHandoffService } from './router.js'
export {
  resolveDefaultServerHostIdentity,
  type ServerHostIdentityProvider,
} from './server-host-identity.js'
export {
  createServer,
  createWebSocketServer,
  startServer,
  type RunningServer,
  type ServerConfig,
} from './server.js'
export { StoreMutationService, type StartStoreMutationInput } from './store-mutation-service.js'
export { TranslationEngineService } from './translation-engine-service.js'
export { runManagedLocalTranslationChildProcess } from './translation-engine-worker.js'
export {
  WorkflowInvocationService,
  type WorkflowInvocationServiceOptions,
} from './workflow-invocation-service.js'
