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

export {
  parseMarkdownFacts,
  toMarkdownFactKind,
  type MarkdownFact,
  type MarkdownFactKind,
  type MarkdownFactsDocument,
  type MarkdownSourcePoint,
  type MarkdownSourceRange,
} from './markdown-facts.js'

export {
  MarkdownReadingPluginRegistry,
  buildMarkdownParentMap,
  createMarkdownReadingDocument,
  createMarkdownReadingDocumentFromFacts,
  getMarkdownAnnotation,
  getMarkdownAnnotationsForFact,
  getMarkdownFactSpan,
  getMarkdownHeadingEnd,
  getMarkdownHeadingFacts,
  sortMarkdownReadingPlugins,
  trimMarkdownSlice,
  type MarkdownAnnotation,
  type MarkdownAnnotationConfidence,
  type MarkdownAnnotationContext,
  type MarkdownAnnotationInput,
  type MarkdownAnnotationRule,
  type MarkdownFactSpan,
  type MarkdownProjectionContext,
  type MarkdownProjectionRule,
  type MarkdownReadingDocument,
  type MarkdownReadingLookup,
  type MarkdownReadingPlugin,
} from './markdown-reading.js'

export {
  annotateOpenSpecFacts,
  annotateOpenSpecMarkdown,
  builtinOpenSpecReadingPlugin,
  getOpenSpecAnnotation,
  getOpenSpecAnnotationsForFact,
  openSpecAnnotationRules,
  type AnnotatedOpenSpecDocument,
  type OpenSpecAnnotation,
  type OpenSpecAnnotationConfidence,
  type OpenSpecScenarioStepKeyword,
  type OpenSpecSemanticKind,
} from './openspec-annotations.js'

export {
  OPEN_SPEC_READING_SECTIONS_PROJECTION_ID,
  OPEN_SPEC_SPEC_PROJECTION_ID,
  createOpenSpecReadingPlugin,
  getOpenSpecProjectionAnnotation,
  getOpenSpecReadingSections,
  parseOpenSpecMarkdownToSpec,
  projectAnnotatedOpenSpecToSpec,
  projectOpenSpecMarkdown,
  type OpenSpecHeadingSection,
  type OpenSpecProjectionOptions,
  type OpenSpecReadingSectionsProjection,
  type OpenSpecRequirementBlock,
  type OpenSpecScenarioBlock,
  type ProjectedOpenSpecDocument,
} from './openspec-projection.js'

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
  ScenarioStepKeywordSchema,
  ScenarioStepSchema,
  SpecSchema,
  TaskSchema,
  type Change,
  type ChangeFile,
  type Delta,
  type DeltaOperation,
  type DeltaSpec,
  type Requirement,
  type ScenarioStep,
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
  subscribeWatcherRuntimeStatus,
  type PathCallback,
  type ProjectResidencyEvictionReason,
  type ProjectResidencyStatus,
  type ProjectWatcherReinitializeReason,
  type ProjectWatcherRuntimeStatus,
  type ProjectWatcherRuntimeStatusListener,
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
  CODE_EDITOR_THEME_VALUES,
  CodeEditorThemeSchema,
  ConfigManager,
  DEFAULT_CONFIG,
  DEFAULT_GIT_DIFF_EAGER_LINE_BUDGET,
  DashboardConfigSchema,
  GitConfigSchema,
  OPSX_AGENT_INVOCATION_MODE_VALUES,
  OpenSpecUIConfigSchema,
  OpsxAgentInvocationModeSchema,
  OpsxConfigSchema,
  TerminalConfigSchema,
  TerminalRendererEngineSchema,
  TerminalThemeModeSchema,
  TerminalThemeSchema,
  buildCliRunnerCandidates,
  createCleanCliEnv,
  getDefaultCliCommand,
  getDefaultCliCommandString,
  isTerminalRendererEngine,
  parseCliCommand,
  sniffGlobalCli,
  type CliRunnerAttempt,
  type CliSniffResult,
  type CodeEditorTheme,
  type DashboardConfig,
  type GitConfig,
  type OpenSpecUIConfig,
  type OpenSpecUIConfigUpdate,
  type OpsxAgentInvocationMode,
  type OpsxConfig,
  type ResolvedCliRunner,
  type TerminalConfig,
  type TerminalRendererEngine,
  type TerminalThemeId,
  type TerminalThemeMode,
} from './config.js'

export {
  BUILTIN_SOUND_IDS,
  BUILTIN_SOUND_OPTIONS,
  BuiltinSoundIdSchema,
  CUSTOM_SOUND_ADD_VALUE,
  CustomSoundHashSchema,
  CustomSoundIdSchema,
  CustomSoundMetadataFileSchema,
  CustomSoundMetadataSchema,
  DEFAULT_BELL_SOUND_ID,
  DEFAULT_NOTIFICATION_SOUND_ID,
  LEGACY_SOUND_ID_MAP,
  SILENT_SOUND_ID,
  SoundConfigIdSchema,
  SoundIdSchema,
  customHashFromSoundId,
  getBuiltinSoundUrl,
  normalizeLegacySoundId,
  soundIdFromCustomHash,
  type BuiltinSoundId,
  type BuiltinSoundOption,
  type CustomSoundHash,
  type CustomSoundId,
  type CustomSoundMetadata,
  type CustomSoundMetadataFile,
  type SoundId,
} from './sounds.js'

export {
  TERMINAL_BELL_SOUND_OPTIONS,
  TERMINAL_BELL_SOUND_VALUES,
  TerminalBellSoundSchema,
  type TerminalBellSound,
} from './terminal-audio.js'

export {
  DOCUMENT_TRANSLATION_DISPLAY_MODES,
  DocumentTranslationConfigSchema,
  DocumentTranslationDisplayModeSchema,
  type DocumentTranslationConfig,
  type DocumentTranslationDisplayMode,
} from './document-translation.js'

export {
  NOTIFICATION_SOUND_OPTIONS,
  NOTIFICATION_SOUND_VALUES,
  NotificationActionSchema,
  NotificationGroupKeySchema,
  NotificationPublishInputSchema,
  NotificationRecordSchema,
  NotificationSettingsSchema,
  NotificationSoundSchema,
  NotificationSourceSchema,
  TerminalNotificationParser,
  getNotificationGroupKey,
  getNotificationGroupLabel,
  groupNotifications,
  terminalNotificationEventToPublishInput,
  type NotificationAction,
  type NotificationGroup,
  type NotificationGroupKey,
  type NotificationPublishInput,
  type NotificationRecord,
  type NotificationSettings,
  type NotificationSound,
  type NotificationSource,
  type TerminalNotificationEvent,
  type TerminalNotificationParseResult,
} from './notifications.js'

export {
  TerminalControlParser,
  type TerminalControlEvent,
  type TerminalControlParseResult,
  type TerminalNotificationProtocol,
  type TerminalProgressState,
  type TerminalPromptState,
  type TerminalTitleTarget,
} from './terminal-control.js'

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
  getDetectedProjectTools,
  getToolById,
  isToolConfigured,
  type AIToolOption,
  type ToolConfig,
} from './tool-config.js'

// Tool initialization state detection
export {
  TOOL_WORKFLOW_TO_SKILL_DIR,
  getToolInitStates,
  type ToolInitDelivery,
  type ToolInitState,
  type ToolInitStatus,
  type ToolWorkflowId,
} from './tool-init-state.js'

// Export types for static site generation
export {
  DASHBOARD_METRIC_KEYS,
  type DashboardCardAvailability,
  type DashboardGitCommitEntry,
  type DashboardGitDiffStats,
  type DashboardGitEntry,
  type DashboardGitSnapshot,
  type DashboardGitUncommittedEntry,
  type DashboardGitWorktree,
  type DashboardMetricKey,
  type DashboardOverview,
  type DashboardSummary,
  type DashboardTrendKind,
  type DashboardTrendMeta,
  type DashboardTrendPoint,
  type DashboardTriColorTrendPoint,
} from './dashboard-types.js'
export { type ExportSnapshot } from './export-types.js'
export {
  type GitEntriesPage,
  type GitEntryCursor,
  type GitEntryDetail,
  type GitEntryFileDiff,
  type GitEntryFilePatch,
  type GitEntryFileSource,
  type GitEntryFileSummary,
  type GitEntryFiles,
  type GitEntryPatch,
  type GitEntrySelector,
  type GitEntryShell,
  type GitFileChangeType,
  type GitPatchFile,
  type GitPatchState,
  type GitWorktreeHandoff,
  type GitWorktreeOverview,
  type GitWorktreeSummary,
} from './git-panel-types.js'
export {
  OPENSPECUI_HOOKS_VERSION,
  type DocumentConsumerV1,
  type DocumentReadModeV1,
  type DocumentRefV1,
  type HookDiagnosticLevel,
  type HookDiagnosticV1,
  type HookLifecycleV1,
  type OnReadDocumentHookV1,
  type OnRunWorkflowHookV1,
  type OpenSpecUIHooksV1,
  type ReadDocumentContextV1,
  type ReadDocumentResultV1,
  type RunWorkflowContextV1,
  type RunWorkflowInputV1,
  type RunWorkflowResultV1,
  type WorkflowActionV1,
  type WorkflowInvocationModeResolutionV1,
  type WorkflowRequestedModeV1,
} from './hooks.js'
export {
  HOSTED_SHELL_PROTOCOL_VERSION,
  OFFICIAL_APP_BASE_URL,
  buildEmbeddedUiLaunchUrl,
  buildHostedLaunchUrl,
  isHostedBackendHealthResponse,
  isSupportedEmbeddedUiUrl,
  normalizeEmbeddedUiUrl,
  normalizeHostedAppBaseUrl,
  resolveHostedAppBaseUrl,
  type HostedBackendHealthResponse,
} from './hosted-app.js'
export { VIRTUAL_PROJECT_DIRNAME, toOpsxDisplayPath } from './opsx-display-path.js'
export { type ProjectRecoveryStatus } from './runtime-types.js'
export {
  BUILTIN_TERMINAL_SPAWN_COMMANDS,
  TERMINAL_COMMAND_FIELD_TYPE_VALUES,
  TERMINAL_SHELL_QUOTE_STYLE_VALUES,
  TerminalCommandFieldSchema,
  TerminalInvocationSettingsSchema,
  TerminalShellProfileSchema,
  TerminalShellQuoteStyleSchema,
  TerminalSpawnCommandSchema,
  getTerminalCommandDefaultValues,
  quoteTerminalShellArg,
  renderTerminalCommandArgs,
  renderTerminalSpawnCommandLine,
  resolveTerminalShellDefaults,
  type TerminalCommandArgument,
  type TerminalCommandField,
  type TerminalCommandFieldValue,
  type TerminalCommandFieldValues,
  type TerminalInvocationSettings,
  type TerminalShellDefaults,
  type TerminalShellProfile,
  type TerminalShellQuoteStyle,
  type TerminalSpawnCommand,
} from './terminal-invocation.js'
export {
  DEFAULT_TERMINAL_DARK_THEME,
  DEFAULT_TERMINAL_LIGHT_THEME,
  DEFAULT_TERMINAL_THEME_MODE,
  TERMINAL_THEME_MODE_VALUES,
  TERMINAL_THEME_VALUES,
} from './terminal-theme.js'

// OPSX Kernel - reactive in-memory data store
export { OpsxKernel, type TemplateContentMap } from './opsx-kernel.js'

// OPSX CLI output schemas and types
export {
  ApplyInstructionsContextFilesSchema,
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
  PtyBellResponseSchema,
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
  PtyProcessTitleResponseSchema,
  PtyResizeMessageSchema,
  PtyServerMessageSchema,
  PtyTitleResponseSchema,
  type PtyClientMessage,
  type PtyPlatform,
  type PtyServerMessage,
  type PtySessionInfo,
} from './pty-protocol.js'
