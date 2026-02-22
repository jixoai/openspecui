/**
 * @openspecui/core
 *
 * Core library for OpenSpec file operations, parsing, and validation.
 * Provides filesystem adapter, markdown parser, and reactive file system for
 * spec-driven development workflows.
 *
 * @packageDocumentation
 */

// Filesystem adapter for reading/writing OpenSpec files
export { OpenSpecAdapter, type ArchiveMeta, type ChangeMeta, type SpecMeta } from './adapter.js'

// Markdown parser for spec and change documents
export { MarkdownParser } from './parser.js'

// Document validation
export { Validator, type ValidationIssue, type ValidationResult } from './validator.js'

// Zod schemas and TypeScript types
export {
  ChangeFileSchema,
  ChangeSchema,
  DeltaOperationType,
  DeltaSchema,
  DeltaSpecSchema,
  RequirementSchema,
  SpecSchema,
  TaskSchema,
  type Change,
  type ChangeFile,
  type Delta,
  type DeltaOperation,
  type DeltaSpec,
  type Requirement,
  type Spec,
  type Task,
} from './schemas.js'

// Reactive file system for realtime updates
export {
  // Low-level project watcher
  ProjectWatcher,
  ReactiveContext,
  // Core classes
  ReactiveState,
  acquireWatcher,
  clearCache,
  closeAllProjectWatchers,
  closeAllWatchers,
  contextStorage,
  getActiveWatcherCount,
  getCacheSize,
  getProjectWatcher,
  getWatchedProjectDir,
  getWatcherRuntimeStatus,
  // Watcher pool management (based on @parcel/watcher)
  initWatcherPool,
  isWatcherPoolInitialized,
  reactiveExists,
  reactiveReadDir,
  // Reactive file operations
  reactiveReadFile,
  reactiveStat,
  type PathCallback,
  type ProjectWatcherReinitializeReason,
  type ProjectWatcherRuntimeStatus,
  type ReactiveStateOptions,
  type WatchEvent,
  type WatchEventType,
  type WatcherRuntimeStatus,
} from './reactive-fs/index.js'

// Legacy file watcher (deprecated, use reactive-fs instead)
export {
  OpenSpecWatcher,
  createFileChangeObservable,
  type FileChangeEvent,
  type FileChangeType,
} from './watcher.js'

// Configuration management
export {
  ConfigManager,
  DEFAULT_CONFIG,
  OpenSpecUIConfigSchema,
  TerminalConfigSchema,
  TerminalRendererEngineSchema,
  buildCliRunnerCandidates,
  createCleanCliEnv,
  getDefaultCliCommand,
  getDefaultCliCommandString,
  isTerminalRendererEngine,
  parseCliCommand,
  sniffGlobalCli,
  type CliRunnerAttempt,
  type CliSniffResult,
  type OpenSpecUIConfig,
  type OpenSpecUIConfigUpdate,
  type ResolvedCliRunner,
  type TerminalConfig,
  type TerminalRendererEngine,
} from './config.js'

// CLI executor for calling external openspec commands
export { CliExecutor, type CliResult, type CliStreamEvent } from './cli-executor.js'

// Tool configuration detection
export {
  AI_TOOLS,
  getAllToolIds,
  getAllTools,
  getAvailableToolIds,
  getAvailableTools,
  getConfiguredTools,
  getToolById,
  isToolConfigured,
  type AIToolOption,
  type ToolConfig,
} from './tool-config.js'

// Export types for static site generation
export { type DashboardOverview } from './dashboard-types.js'
export { type ExportSnapshot } from './export-types.js'

// OPSX Kernel - reactive in-memory data store
export { OpsxKernel, type TemplateContentMap } from './opsx-kernel.js'

// OPSX CLI output schemas and types
export {
  ApplyInstructionsSchema,
  ApplyTaskSchema,
  ArtifactInstructionsSchema,
  ArtifactStatusSchema,
  ChangeStatusSchema,
  DependencyInfoSchema,
  SchemaArtifactSchema,
  SchemaDetailSchema,
  SchemaInfoSchema,
  SchemaResolutionSchema,
  TemplatesSchema,
  isGlobPattern,
  type ApplyInstructions,
  type ApplyTask,
  type ArtifactInstructions,
  type ArtifactStatus,
  type ChangeStatus,
  type DependencyInfo,
  type SchemaArtifact,
  type SchemaDetail,
  type SchemaInfo,
  type SchemaResolution,
  type TemplatesMap,
} from './opsx-types.js'

// PTY WebSocket protocol schemas and types
export {
  PtyAttachMessageSchema,
  PtyBufferResponseSchema,
  PtyClientMessageSchema,
  PtyCloseMessageSchema,
  PtyCreateMessageSchema,
  PtyCreatedResponseSchema,
  PtyErrorCodeSchema,
  PtyErrorResponseSchema,
  PtyExitResponseSchema,
  PtyInputMessageSchema,
  PtyListMessageSchema,
  PtyListResponseSchema,
  PtyOutputResponseSchema,
  PtyPlatformSchema,
  PtyResizeMessageSchema,
  PtyServerMessageSchema,
  PtyTitleResponseSchema,
  type PtyClientMessage,
  type PtyPlatform,
  type PtyServerMessage,
  type PtySessionInfo,
} from './pty-protocol.js'
