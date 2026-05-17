import { parse as parseYaml } from 'yaml'
import type { SchemaDetail } from './opsx-types.js'
import type { ChangeFile } from './schemas.js'

export type OpsxEntityStage = 'change' | 'archive'

export interface OpsxEntityDiagnostic {
  level: 'info' | 'warning' | 'error'
  message: string
  path?: string
}

export type OpsxEntityFile = ChangeFile
export type OpsxEntityArtifactFile = ChangeFile & { type: 'file' }

export interface OpsxEntityArtifact {
  id: string
  outputPath: string
  description?: string
  files: OpsxEntityArtifactFile[]
}

export interface OpsxEntityDetail {
  stage: OpsxEntityStage
  id: string
  exists: true
  schemaName?: string
  files: OpsxEntityFile[]
  artifacts: OpsxEntityArtifact[]
  ungroupedFiles: OpsxEntityFile[]
  diagnostics: OpsxEntityDiagnostic[]
}

export interface OpsxEntityReadOptions {
  schemas?: Record<string, SchemaDetail | null | undefined>
  schemaDiagnostics?: Record<string, readonly OpsxEntityDiagnostic[] | undefined>
}

export function getOpsxEntityRootRelativePath(stage: OpsxEntityStage, id: string): string {
  return stage === 'change' ? `openspec/changes/${id}` : `openspec/changes/archive/${id}`
}

export function getOpsxEntityMetadataPath(stage: OpsxEntityStage, id: string): string {
  return `${getOpsxEntityRootRelativePath(stage, id)}/.openspec.yaml`
}

interface ParsedEntityMetadata {
  schemaName?: string
  diagnostics: OpsxEntityDiagnostic[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function normalizeOpsxEntityPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/^\/+/, '')
}

export function isOpsxGlobPattern(path: string): boolean {
  return path.includes('*') || path.includes('?') || path.includes('[')
}

function escapeRegexChar(char: string): string {
  return /[\\^$.*+?()[\]{}|]/.test(char) ? `\\${char}` : char
}

export function opsxGlobToRegex(pattern: string): RegExp {
  const normalized = normalizeOpsxEntityPath(pattern)
  let source = '^'

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index]
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        index += 1
        if (normalized[index + 1] === '/') {
          index += 1
          source += '(?:.*/)?'
        } else {
          source += '.*'
        }
      } else {
        source += '[^/]*'
      }
      continue
    }
    if (char === '?') {
      source += '[^/]'
      continue
    }
    if (char === '[') {
      const closeIndex = normalized.indexOf(']', index + 1)
      if (closeIndex > index + 1) {
        source += normalized.slice(index, closeIndex + 1)
        index = closeIndex
        continue
      }
    }
    source += escapeRegexChar(char)
  }

  source += '$'
  return new RegExp(source)
}

export function opsxPathMatchesPattern(path: string, pattern: string): boolean {
  const normalizedPath = normalizeOpsxEntityPath(path)
  const normalizedPattern = normalizeOpsxEntityPath(pattern)
  if (!isOpsxGlobPattern(normalizedPattern)) {
    return normalizedPath === normalizedPattern
  }
  return opsxGlobToRegex(normalizedPattern).test(normalizedPath)
}

export function parseOpsxEntityMetadata(content: string | null | undefined): ParsedEntityMetadata {
  if (!content) return { diagnostics: [] }

  try {
    const parsed = parseYaml(content) as unknown
    if (!isRecord(parsed)) {
      return {
        diagnostics: [
          {
            level: 'warning',
            path: '.openspec.yaml',
            message: 'Entity metadata is not a YAML object.',
          },
        ],
      }
    }
    const schema = parsed.schema
    if (typeof schema === 'string' && schema.trim().length > 0) {
      return { schemaName: schema.trim(), diagnostics: [] }
    }
    return {
      diagnostics: [
        {
          level: 'warning',
          path: '.openspec.yaml',
          message: 'Entity metadata does not declare a usable schema name.',
        },
      ],
    }
  } catch (error) {
    return {
      diagnostics: [
        {
          level: 'warning',
          path: '.openspec.yaml',
          message: `Entity metadata could not be parsed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
    }
  }
}

function getMetadataContent(files: ChangeFile[]): string | null {
  const metadata = files.find((file) => file.type === 'file' && file.path === '.openspec.yaml')
  return metadata?.type === 'file' ? (metadata.content ?? null) : null
}

function getSchemaDetail(
  schemaName: string | undefined,
  schemas: OpsxEntityReadOptions['schemas'],
  schemaDiagnostics: OpsxEntityReadOptions['schemaDiagnostics'],
  diagnostics: OpsxEntityDiagnostic[]
): SchemaDetail | null {
  if (!schemaName) return null
  const schemaDiagnosticItems = schemaDiagnostics?.[schemaName]
  if (schemaDiagnosticItems) {
    diagnostics.push(...schemaDiagnosticItems)
  }
  if (!schemas) return null

  const detail = schemas[schemaName]
  if (detail) return detail

  diagnostics.push({
    level: 'warning',
    path: '.openspec.yaml',
    message: `Schema "${schemaName}" is not available; showing entity files without schema artifact binding.`,
  })
  return null
}

function getArtifactFiles(files: ChangeFile[], outputPath: string): OpsxEntityArtifactFile[] {
  return files.filter((file): file is OpsxEntityArtifactFile => {
    if (file.type !== 'file') return false
    return opsxPathMatchesPattern(file.path, outputPath)
  })
}

export function buildOpsxEntityDetail(input: {
  stage: OpsxEntityStage
  id: string
  files: ChangeFile[]
  schemas?: Record<string, SchemaDetail | null | undefined>
  schemaDiagnostics?: Record<string, readonly OpsxEntityDiagnostic[] | undefined>
}): OpsxEntityDetail {
  const diagnostics: OpsxEntityDiagnostic[] = []
  const metadata = parseOpsxEntityMetadata(getMetadataContent(input.files))
  diagnostics.push(...metadata.diagnostics)

  const schemaDetail = getSchemaDetail(
    metadata.schemaName,
    input.schemas,
    input.schemaDiagnostics,
    diagnostics
  )
  const artifactPathSet = new Set<string>()
  const artifacts: OpsxEntityArtifact[] =
    schemaDetail?.artifacts.map((artifact) => {
      const files = getArtifactFiles(input.files, artifact.outputPath)
      for (const file of files) artifactPathSet.add(file.path)
      return {
        id: artifact.id,
        outputPath: artifact.outputPath,
        description: artifact.description,
        files,
      }
    }) ?? []

  const ungroupedFiles = input.files.filter((file) => {
    if (file.type !== 'file') return true
    return !artifactPathSet.has(file.path)
  })

  return {
    stage: input.stage,
    id: input.id,
    exists: true,
    schemaName: metadata.schemaName,
    files: input.files,
    artifacts,
    ungroupedFiles,
    diagnostics,
  }
}
