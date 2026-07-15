/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Preserve every process-level fact from an OpenSpec CLI invocation.
 * 2. Validate command payloads without discarding the raw JSON document.
 * 3. Surface contract drift separately from CLI command failure.
 *
 * Original request (2026-07-15): "对新增字段保持可扩展，对必需语义严格验证。"
 */
import { z } from 'zod'
import type { CliResult } from '../cli-executor.js'
import { CliDiagnosticSchema, type CliDiagnostic } from './common.js'

export interface CliCommandResult<T> extends CliResult {
  data: T | null
  payload: unknown | null
  diagnostics: CliDiagnostic[]
  contractError?: string
}

function formatContractError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '<root>'
      return `${path}: ${issue.message}`
    })
    .join('; ')
}

function extractDiagnostics(payload: unknown): CliDiagnostic[] {
  if (typeof payload !== 'object' || payload === null || !('status' in payload)) return []
  const parsed = z.array(CliDiagnosticSchema).safeParse(payload.status)
  return parsed.success ? parsed.data : []
}

/** Parse one CLI JSON document while retaining all process and raw-payload evidence. */
export function parseCliCommandResult<T>(
  result: CliResult,
  schema: z.ZodType<T>
): CliCommandResult<T> {
  let payload: unknown
  try {
    payload = JSON.parse(result.stdout)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      ...result,
      data: null,
      payload: null,
      diagnostics: [],
      contractError: `OpenSpec CLI stdout is not one JSON document: ${message}`,
    }
  }

  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return {
      ...result,
      data: null,
      payload,
      diagnostics: extractDiagnostics(payload),
      contractError: formatContractError(parsed.error),
    }
  }

  return {
    ...result,
    data: parsed.data,
    payload,
    diagnostics: extractDiagnostics(parsed.data),
  }
}
