/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Resolve the OPSX Schema detail and diagnostic metadata for one change/archive entity.
 * 2. Delegate schema resolution through the Kernel ensure contract while tolerating missing schemas.
 * 3. Never block on Kernel warmup: schema diagnostics are optional display enrichment, so return
 *    cached/empty data immediately and let reactive invalidation fill them after warmup settles.
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 * Performance correction (2026-07-23): Status must not block on Kernel warmup; schema diagnostics are optional.
 * Hotpath correction (2026-07-31): `buildEntityReadOptions` removed `waitForWarmup()` blocking because
 *   `fetchSchemas` (~1.2s) dominated detail-page latency. Schema data is now read opportunistically
 *   from whatever the Kernel has already cached; reactive invalidation fills the rest.
 */
import {
  parseOpsxEntityMetadata,
  parseOpsxSchemaDetail,
  type OpenSpecAdapter,
  type OpsxEntityReadOptions,
  type OpsxEntityStage,
  type OpsxKernel,
} from '@openspecui/core'

export interface EntityReadOptionsContext {
  adapter: OpenSpecAdapter
  kernel: OpsxKernel
}

async function readEntityMetadata(
  ctx: EntityReadOptionsContext,
  stage: OpsxEntityStage,
  id: string
): Promise<string | null> {
  const files =
    stage === 'change'
      ? await ctx.adapter.readChangeFiles(id)
      : await ctx.adapter.readArchivedChangeFiles(id)
  return (
    files.find((file) => file.type === 'file' && file.path === '.openspec.yaml')?.content ?? null
  )
}

export async function buildEntityReadOptions(
  ctx: EntityReadOptionsContext,
  stage: OpsxEntityStage,
  id: string
): Promise<OpsxEntityReadOptions> {
  const schemaName = parseOpsxEntityMetadata(await readEntityMetadata(ctx, stage, id)).schemaName
  if (!schemaName) return {}

  try {
    // Read opportunistically from whatever the Kernel has already cached. Do NOT await warmup:
    // on first detail-page load the Kernel has not warmed up yet, and `fetchSchemas` (~1.2s)
    // would block the entire response. Reactive invalidation re-emits once schemas are ready.
    const schemaDetail = ctx.kernel.tryGetSchemaDetail(schemaName)
    const schemaYaml = ctx.kernel.tryGetSchemaYaml(schemaName)
    const diagnostics = schemaYaml
      ? parseOpsxSchemaDetail(schemaYaml, schemaName, { path: `schema:${schemaName}` }).diagnostics
      : []
    return {
      ...(schemaDetail ? { schemas: { [schemaName]: schemaDetail } } : {}),
      ...(diagnostics.length > 0 ? { schemaDiagnostics: { [schemaName]: diagnostics } } : {}),
    }
  } catch {
    return { schemas: {} }
  }
}
