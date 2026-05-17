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
    await ctx.kernel.waitForWarmup()
    await ctx.kernel.ensureSchemaDetail(schemaName)
    await ctx.kernel.ensureSchemaYaml(schemaName)
    const schemaYaml = ctx.kernel.getSchemaYaml(schemaName)
    const diagnostics = schemaYaml
      ? parseOpsxSchemaDetail(schemaYaml, schemaName, { path: `schema:${schemaName}` }).diagnostics
      : []
    return {
      schemas: { [schemaName]: ctx.kernel.getSchemaDetail(schemaName) },
      schemaDiagnostics: diagnostics.length > 0 ? { [schemaName]: diagnostics } : undefined,
    }
  } catch {
    return { schemas: {} }
  }
}
