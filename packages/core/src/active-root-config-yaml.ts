/**
 * Orthogonal intents (updated 2026-08-02 Asia/Shanghai):
 * 1. Inspect OpenSpec 1.7 official fields resiliently while ignoring team-key ownership.
 * 2. Validate Raw YAML syntax without imposing the official key set.
 * 3. Patch only Structured-owned YAML nodes while retaining representable presentation and extensions.
 *
 * Original request (2026-08-01): preserve complete raw YAML because teams may define their own configuration keys.
 * Derived checkpoint (2026-08-02): Structured mode owns schema, context, rules, and apply/archive guidance only.
 */
import { isMap, isNode, isScalar, isSeq, parseDocument, type Document, type YAMLMap } from 'yaml'
import {
  ActiveRootStructuredUpdateSchema,
  MAX_ACTIVE_ROOT_CONTEXT_BYTES,
  type ActiveRootConfigDiagnostic,
  type ActiveRootConfigInspection,
  type ActiveRootRawValidation,
  type ActiveRootStructuredUpdate,
} from './active-root-config-contract.js'

const EMPTY_OFFICIAL_CONFIG = {
  schema: null,
  context: null,
  rules: null,
  operations: null,
} as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function contextByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function yamlErrors(content: string): ActiveRootConfigDiagnostic[] {
  const document = parseDocument(content)
  if (document.errors.length === 0) return []
  return [
    {
      code: 'config-unparseable',
      severity: 'error',
      path: '$',
      message: document.errors.map((error) => error.message).join('\n'),
    },
  ]
}

function inspectRules(
  value: unknown,
  diagnostics: ActiveRootConfigDiagnostic[]
): Record<string, string[]> | null {
  if (value === undefined) return null
  if (!isRecord(value)) {
    diagnostics.push({
      code: 'rules-invalid',
      severity: 'error',
      path: 'rules',
      message: 'The rules field must be a mapping of artifact ids to string arrays.',
    })
    return null
  }

  const rules: Record<string, string[]> = {}
  for (const [artifactId, candidate] of Object.entries(value)) {
    if (!Array.isArray(candidate) || candidate.some((entry) => typeof entry !== 'string')) {
      diagnostics.push({
        code: 'rules-entry-invalid',
        severity: 'error',
        path: `rules.${artifactId}`,
        message: `Rules for '${artifactId}' must be an array of strings.`,
      })
      continue
    }
    const entries = candidate.filter((entry) => entry.length > 0)
    if (entries.length < candidate.length) {
      diagnostics.push({
        code: 'rules-entry-empty',
        severity: 'warning',
        path: `rules.${artifactId}`,
        message: `Empty rules for '${artifactId}' are ignored by OpenSpec.`,
      })
    }
    if (entries.length > 0) rules[artifactId] = entries
  }
  return Object.keys(rules).length > 0 ? rules : null
}

function inspectOperations(
  value: unknown,
  diagnostics: ActiveRootConfigDiagnostic[]
): ActiveRootConfigInspection['official']['operations'] {
  if (value === undefined) return null
  if (!isRecord(value)) {
    diagnostics.push({
      code: 'operations-invalid',
      severity: 'error',
      path: 'operations',
      message: 'The operations field must be a mapping.',
    })
    return null
  }

  const operations: NonNullable<ActiveRootConfigInspection['official']['operations']> = {}
  for (const operationId of ['apply', 'archive'] as const) {
    const candidate = value[operationId]
    if (candidate === undefined) continue
    if (!isRecord(candidate)) {
      diagnostics.push({
        code: 'operation-invalid',
        severity: 'error',
        path: `operations.${operationId}`,
        message: `Operation '${operationId}' must be a mapping.`,
      })
      continue
    }
    if (candidate.guidance === undefined) continue
    if (
      !Array.isArray(candidate.guidance) ||
      candidate.guidance.some((entry) => typeof entry !== 'string')
    ) {
      diagnostics.push({
        code: 'operation-guidance-invalid',
        severity: 'error',
        path: `operations.${operationId}.guidance`,
        message: `Guidance for '${operationId}' must be an array of strings.`,
      })
      continue
    }
    const guidance = candidate.guidance.filter((entry) => entry.length > 0)
    if (guidance.length < candidate.guidance.length) {
      diagnostics.push({
        code: 'operation-guidance-empty',
        severity: 'warning',
        path: `operations.${operationId}.guidance`,
        message: `Empty '${operationId}' guidance entries are ignored by OpenSpec.`,
      })
    }
    if (guidance.length > 0) operations[operationId] = { guidance }
  }
  return Object.keys(operations).length > 0 ? operations : null
}

/** Inspect official OpenSpec 1.7 Active Root fields independently and retain recoverable diagnostics. */
export function inspectActiveRootOfficialConfig(
  content: string | null
): ActiveRootConfigInspection {
  if (content === null || content.trim().length === 0) {
    return {
      official: { ...EMPTY_OFFICIAL_CONFIG },
      diagnostics: [
        {
          code: 'schema-missing',
          severity: 'error',
          path: 'schema',
          message: 'The active OpenSpec config does not declare a schema.',
        },
      ],
    }
  }

  const document = parseDocument(content)
  if (document.errors.length > 0) {
    return { official: { ...EMPTY_OFFICIAL_CONFIG }, diagnostics: yamlErrors(content) }
  }
  const raw: unknown = document.toJS()
  if (!isRecord(raw)) {
    return {
      official: { ...EMPTY_OFFICIAL_CONFIG },
      diagnostics: [
        {
          code: 'config-not-mapping',
          severity: 'error',
          path: '$',
          message: 'OpenSpec config must be a YAML mapping for Structured mode.',
        },
      ],
    }
  }

  const diagnostics: ActiveRootConfigDiagnostic[] = []
  let schema: string | null = null
  if (raw.schema === undefined) {
    diagnostics.push({
      code: 'schema-missing',
      severity: 'error',
      path: 'schema',
      message: 'The active OpenSpec config does not declare a schema.',
    })
  } else if (typeof raw.schema !== 'string' || raw.schema.length === 0) {
    diagnostics.push({
      code: 'schema-invalid',
      severity: 'error',
      path: 'schema',
      message: 'The schema field must be a non-empty string.',
    })
  } else {
    schema = raw.schema
  }

  let context: string | null = null
  if (raw.context !== undefined) {
    if (typeof raw.context !== 'string') {
      diagnostics.push({
        code: 'context-invalid',
        severity: 'error',
        path: 'context',
        message: 'The context field must be a string.',
      })
    } else if (contextByteLength(raw.context) > MAX_ACTIVE_ROOT_CONTEXT_BYTES) {
      diagnostics.push({
        code: 'context-too-large',
        severity: 'error',
        path: 'context',
        message: `The context field exceeds ${MAX_ACTIVE_ROOT_CONTEXT_BYTES} UTF-8 bytes.`,
      })
    } else {
      context = raw.context
    }
  }

  return {
    official: {
      schema,
      context,
      rules: inspectRules(raw.rules, diagnostics),
      operations: inspectOperations(raw.operations, diagnostics),
    },
    diagnostics,
  }
}

/** Validate Raw-mode YAML syntax while allowing any syntactically valid document shape and custom keys. */
export function validateActiveRootRawYaml(content: string): ActiveRootRawValidation {
  const diagnostics = yamlErrors(content)
  return { valid: diagnostics.length === 0, diagnostics }
}

type EditableDocument = Document.Parsed

function editableDocument(content: string | null): EditableDocument {
  const document = parseDocument(content ?? '')
  if (document.errors.length > 0) {
    throw new Error(
      `Active Root cannot be edited in Structured mode: ${document.errors.map((error) => error.message).join('\n')}`
    )
  }
  if (document.contents !== null && !isMap(document.contents)) {
    throw new Error(
      'Active Root cannot be edited in Structured mode: config is not a YAML mapping.'
    )
  }
  return document
}

function copyPresentation(source: unknown, target: unknown): void {
  if (!isNode(source) || !isNode(target)) return
  target.comment = source.comment
  target.commentBefore = source.commentBefore
  target.spaceBefore = source.spaceBefore
  if (isScalar(source) && isScalar(target) && typeof target.value === 'string') {
    target.type = source.type
  }
  if ((isMap(source) && isMap(target)) || (isSeq(source) && isSeq(target))) {
    target.flow = source.flow
  }
  if (isSeq(source) && isSeq(target)) {
    for (let index = 0; index < Math.min(source.items.length, target.items.length); index += 1) {
      copyPresentation(source.items[index], target.items[index])
    }
  }
}

function replaceNode(document: EditableDocument, path: readonly string[], value: unknown): void {
  const previous: unknown = document.getIn(path, true)
  const replacement = document.createNode(value)
  copyPresentation(previous, replacement)
  document.setIn(path, replacement)
}

function ensureMap(document: EditableDocument, path: readonly string[]): YAMLMap {
  const current: unknown = document.getIn(path, true)
  if (isMap(current)) return current
  replaceNode(document, path, {})
  const replacement: unknown = document.getIn(path, true)
  if (!isMap(replacement)) throw new Error(`Unable to create YAML mapping at ${path.join('.')}.`)
  return replacement
}

function mappingStringKeys(mapping: YAMLMap): string[] {
  const keys: string[] = []
  for (const pair of mapping.items) {
    if (isScalar(pair.key) && typeof pair.key.value === 'string') keys.push(pair.key.value)
  }
  return keys
}

function patchRules(document: EditableDocument, rules: Record<string, string[]> | null): void {
  if (rules === null) {
    document.delete('rules')
    return
  }
  const mapping = ensureMap(document, ['rules'])
  for (const artifactId of mappingStringKeys(mapping)) {
    if (!Object.hasOwn(rules, artifactId)) mapping.delete(artifactId)
  }
  for (const [artifactId, entries] of Object.entries(rules)) {
    replaceNode(document, ['rules', artifactId], entries)
  }
}

function removeOperationGuidance(
  document: EditableDocument,
  operationId: 'apply' | 'archive'
): void {
  const operations: unknown = document.getIn(['operations'], true)
  if (!isMap(operations)) return
  const operation: unknown = document.getIn(['operations', operationId], true)
  if (isMap(operation)) {
    operation.delete('guidance')
    if (operation.items.length === 0) operations.delete(operationId)
  } else if (operation !== undefined) {
    operations.delete(operationId)
  }
  if (operations.items.length === 0) document.delete('operations')
}

function patchOperations(
  document: EditableDocument,
  operations: ActiveRootStructuredUpdate['operations']
): void {
  if (operations === null) {
    removeOperationGuidance(document, 'apply')
    removeOperationGuidance(document, 'archive')
    return
  }
  ensureMap(document, ['operations'])
  for (const operationId of ['apply', 'archive'] as const) {
    const operation = operations[operationId]
    if (operation === null) {
      removeOperationGuidance(document, operationId)
      continue
    }
    ensureMap(document, ['operations', operationId])
    replaceNode(document, ['operations', operationId, 'guidance'], operation.guidance)
  }
}

/** Patch only Structured-owned official nodes and retain all representable unowned YAML evidence. */
export function patchActiveRootOfficialFields(
  content: string | null,
  update: ActiveRootStructuredUpdate
): string {
  const validated = ActiveRootStructuredUpdateSchema.parse(update)
  const document = editableDocument(content)
  replaceNode(document, ['schema'], validated.schema)
  if (validated.context === null) document.delete('context')
  else replaceNode(document, ['context'], validated.context)
  patchRules(document, validated.rules)
  patchOperations(document, validated.operations)
  return document.toString({ lineWidth: 0 })
}
