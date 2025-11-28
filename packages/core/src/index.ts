/**
 * @openspecui/core
 *
 * Core library for OpenSpec file operations, parsing, and validation.
 * Provides filesystem adapter, markdown parser, and file watcher for
 * spec-driven development workflows.
 *
 * @packageDocumentation
 */

// Filesystem adapter for reading/writing OpenSpec files
export { OpenSpecAdapter } from './adapter.js'

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
  TaskSchema,
  type Spec,
  type Change,
  type Requirement,
  type Delta,
  type Task,
} from './schemas.js'

// File watcher for realtime updates
export {
  OpenSpecWatcher,
  createFileChangeObservable,
  type FileChangeEvent,
  type FileChangeType,
} from './watcher.js'
