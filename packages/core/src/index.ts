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
export { OpenSpecAdapter, type SpecMeta, type ChangeMeta, type ArchiveMeta } from './adapter.js'

// Markdown parser for spec and change documents
export { MarkdownParser } from './parser.js'

// Document validation
export { Validator, type ValidationResult, type ValidationIssue } from './validator.js'

// Zod schemas and TypeScript types
export {
  SpecSchema,
  ChangeSchema,
  RequirementSchema,
  DeltaSchema,
  DeltaSpecSchema,
  DeltaOperationType,
  ChangeFileSchema,
  TaskSchema,
  type Spec,
  type Change,
  type Requirement,
  type Delta,
  type DeltaOperation,
  type DeltaSpec,
  type ChangeFile,
  type Task,
} from './schemas.js'

// Reactive file system for realtime updates
export {
  // Core classes
  ReactiveState,
  ReactiveContext,
  contextStorage,
  type ReactiveStateOptions,
  // Reactive file operations
  reactiveReadFile,
  reactiveReadDir,
  reactiveExists,
  reactiveStat,
  clearCache,
  getCacheSize,
  // Watcher pool management (based on @parcel/watcher)
  initWatcherPool,
  acquireWatcher,
  getActiveWatcherCount,
  closeAllWatchers,
  isWatcherPoolInitialized,
  getWatchedProjectDir,
  // Low-level project watcher
  ProjectWatcher,
  getProjectWatcher,
  closeAllProjectWatchers,
  type WatchEvent,
  type WatchEventType,
  type PathCallback,
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
  OpenSpecUIConfigSchema,
  DEFAULT_CONFIG,
  getDefaultCliCommand,
  getDefaultCliCommandString,
  sniffGlobalCli,
  parseCliCommand,
  type OpenSpecUIConfig,
  type CliSniffResult,
} from './config.js'

// CLI executor for calling external openspec commands
export { CliExecutor, type CliResult, type CliStreamEvent } from './cli-executor.js'

// Tool configuration detection
export {
  AI_TOOLS,
  getAvailableTools,
  getAvailableToolIds,
  getAllTools,
  getAllToolIds,
  getToolById,
  getConfiguredTools,
  isToolConfigured,
  type AIToolOption,
  type ToolConfig,
} from './tool-config.js'

// Export types for static site generation
export { type ExportSnapshot } from './export-types.js'

// OPSX Kernel - reactive in-memory data store
export { OpsxKernel, type TemplateContentMap } from './opsx-kernel.js'

// OPSX CLI output schemas and types
export {
  isGlobPattern,
  ArtifactStatusSchema,
  ChangeStatusSchema,
  DependencyInfoSchema,
  ApplyTaskSchema,
  ApplyInstructionsSchema,
  ArtifactInstructionsSchema,
  SchemaInfoSchema,
  SchemaResolutionSchema,
  TemplatesSchema,
  SchemaArtifactSchema,
  SchemaDetailSchema,
  type ArtifactStatus,
  type ChangeStatus,
  type DependencyInfo,
  type ApplyTask,
  type ApplyInstructions,
  type ArtifactInstructions,
  type SchemaInfo,
  type SchemaResolution,
  type TemplatesMap,
  type SchemaArtifact,
  type SchemaDetail,
} from './opsx-types.js'

// PTY WebSocket protocol schemas and types
export {
  PtyCreateMessageSchema,
  PtyInputMessageSchema,
  PtyResizeMessageSchema,
  PtyCloseMessageSchema,
  PtyAttachMessageSchema,
  PtyListMessageSchema,
  PtyClientMessageSchema,
  PtyCreatedResponseSchema,
  PtyOutputResponseSchema,
  PtyExitResponseSchema,
  PtyTitleResponseSchema,
  PtyBufferResponseSchema,
  PtyListResponseSchema,
  PtyErrorCodeSchema,
  PtyErrorResponseSchema,
  PtyServerMessageSchema,
  type PtyClientMessage,
  type PtyServerMessage,
  type PtySessionInfo,
} from './pty-protocol.js'
