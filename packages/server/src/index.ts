/**
 * Orthogonal intents (updated 2026-07-24 Asia/Shanghai):
 * 1. Publish the supported Server package surface.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */
export {
  checkWebSocketConnectionParams,
  createAccessGate,
  createAccessGateMiddleware,
  extractBearerCredential,
  isLoopbackHostname,
  type AccessGate,
} from './access-gate.js'
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
