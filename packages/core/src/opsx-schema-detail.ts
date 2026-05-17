import { parse as parseYaml } from 'yaml'
import type { OpsxEntityDiagnostic } from './opsx-entity.js'
import type { SchemaArtifact, SchemaDetail } from './opsx-types.js'

export interface ParsedOpsxSchemaDetail {
  detail: SchemaDetail
  diagnostics: OpsxEntityDiagnostic[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function stringField(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function stringOrNumberField(
  record: Record<string, unknown>,
  key: string
): string | number | undefined {
  const value = record[key]
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return undefined
}

function stringArrayField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export function parseOpsxSchemaDetail(
  content: string,
  fallbackName: string,
  options: { path?: string } = {}
): ParsedOpsxSchemaDetail {
  const path = options.path ?? 'schema.yaml'
  const diagnostics: OpsxEntityDiagnostic[] = []
  let raw: unknown

  try {
    raw = parseYaml(content) as unknown
  } catch (error) {
    diagnostics.push({
      level: 'warning',
      path,
      message: `Schema YAML could not be parsed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    })
    return {
      detail: { name: fallbackName, artifacts: [], applyRequires: [] },
      diagnostics,
    }
  }

  if (!isRecord(raw)) {
    diagnostics.push({
      level: 'warning',
      path,
      message: 'Schema YAML is not an object; artifact binding is unavailable.',
    })
    return {
      detail: { name: fallbackName, artifacts: [], applyRequires: [] },
      diagnostics,
    }
  }

  const artifactsRaw = raw.artifacts
  const artifacts: SchemaArtifact[] = []
  if (Array.isArray(artifactsRaw)) {
    artifactsRaw.forEach((item, index) => {
      const artifactPath = `${path}:artifacts[${index}]`
      if (!isRecord(item)) {
        diagnostics.push({
          level: 'warning',
          path: artifactPath,
          message: 'Schema artifact is not an object and was skipped.',
        })
        return
      }

      const id = stringField(item, 'id')
      const outputPath = stringField(item, 'generates') ?? stringField(item, 'outputPath')
      if (!id || !outputPath) {
        diagnostics.push({
          level: 'warning',
          path: artifactPath,
          message: 'Schema artifact is missing a usable id or output path and was skipped.',
        })
        return
      }

      artifacts.push({
        id,
        outputPath,
        description: stringField(item, 'description'),
        template: stringField(item, 'template'),
        instruction: stringField(item, 'instruction'),
        requires: stringArrayField(item, 'requires'),
      })
    })
  } else if (artifactsRaw !== undefined) {
    diagnostics.push({
      level: 'warning',
      path,
      message: 'Schema artifacts must be an array; artifact binding is unavailable.',
    })
  }

  const apply = isRecord(raw.apply) ? raw.apply : {}
  if (raw.apply !== undefined && !isRecord(raw.apply)) {
    diagnostics.push({
      level: 'warning',
      path,
      message: 'Schema apply block is not an object and was ignored.',
    })
  }

  return {
    detail: {
      name: stringField(raw, 'name') ?? fallbackName,
      description: stringField(raw, 'description'),
      version: stringOrNumberField(raw, 'version'),
      artifacts,
      applyRequires: stringArrayField(apply, 'requires'),
      applyTracks: stringField(apply, 'tracks'),
      applyInstruction: stringField(apply, 'instruction'),
    },
    diagnostics,
  }
}
