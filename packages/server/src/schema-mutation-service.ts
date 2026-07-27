/**
 * Orthogonal intents (created 2026-07-17 Asia/Shanghai):
 * 1. Own typed project-Schema and Template mutations inside one Planning root.
 * 2. Delegate direct writes, creates, and deletes to the physical/reactive Core boundary.
 * 3. Run schema init/fork through a Planning-root-local CLI executor without Store selection.
 * 4. Keep user and package Schema sources explicitly read-only.
 *
 * Original request (2026-07-16): "Schema/Template mutations must reject symlink escape and settle reactive projections before success."
 * Original request (2026-07-17): "Use one exhaustive typed source of truth for Schema action validation and execution."
 */
import {
  createPhysicalReactiveDirectory,
  removePhysicalReactivePath,
  requireOpenSpecEntityRelativePath,
  runPhysicalReactivePathMutation,
  writePhysicalReactiveFile,
  type CliResult,
  type SchemaResolution,
  type TemplatesMap,
} from '@openspecui/core'
import { relative, resolve } from 'node:path'
import { match } from 'ts-pattern'
import { z } from 'zod'

const schemaNameSchema = z
  .string()
  .refine(
    (value) => /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value),
    'Invalid Schema name: expected a kebab-case project Schema name.'
  )
const artifactIdSchema = z
  .string()
  .refine(
    (value) =>
      value.length > 0 &&
      value === value.trim() &&
      value !== '.' &&
      value !== '..' &&
      !value.includes('/') &&
      !value.includes('\\') &&
      !value.includes('\0'),
    'Invalid Schema artifact id: expected one canonical path segment.'
  )
const entityRelativePathSchema = z.string().refine((value) => {
  try {
    requireOpenSpecEntityRelativePath(value, 'path')
    return true
  } catch {
    return false
  }
}, 'Invalid Schema path: expected an entity-relative path.')

/** Single runtime and type-level vocabulary for project-Schema mutations. */
export const SchemaMutationActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('init'), name: schemaNameSchema }),
  z.object({ action: z.literal('fork'), source: schemaNameSchema, name: schemaNameSchema }),
  z.object({ action: z.literal('write-yaml'), schema: schemaNameSchema, content: z.string() }),
  z.object({
    action: z.literal('write-file'),
    schema: schemaNameSchema,
    path: entityRelativePathSchema,
    content: z.string(),
  }),
  z.object({
    action: z.literal('create-file'),
    schema: schemaNameSchema,
    path: entityRelativePathSchema,
    content: z.string().optional(),
  }),
  z.object({
    action: z.literal('create-directory'),
    schema: schemaNameSchema,
    path: entityRelativePathSchema,
  }),
  z.object({
    action: z.literal('delete-entry'),
    schema: schemaNameSchema,
    path: entityRelativePathSchema,
  }),
  z.object({
    action: z.literal('write-template'),
    schema: schemaNameSchema,
    artifactId: artifactIdSchema,
    content: z.string(),
  }),
  z.object({ action: z.literal('delete-schema'), schema: schemaNameSchema }),
])

/** Typed project-Schema mutation accepted by the Planning-root owner. */
export type SchemaMutationAction = z.infer<typeof SchemaMutationActionSchema>

/** Minimal root-local CLI contract used only for typed schema init/fork commands. */
export interface SchemaMutationCliExecutor {
  execute(args: string[]): Promise<CliResult>
}

/** Minimal OPSX projection contract needed to verify project Schema ownership. */
export interface SchemaMutationKernel {
  ensureSchemaResolution(name: string): Promise<void>
  getSchemaResolution(name: string): SchemaResolution
  ensureTemplates(schema?: string): Promise<void>
  getTemplates(schema?: string): TemplatesMap
}

/** Dependencies owned by one Planning-root Schema mutation service record. */
export interface SchemaMutationServiceOptions {
  planningRoot: string
  cliExecutor: SchemaMutationCliExecutor
  kernel: SchemaMutationKernel
}

interface ProjectSchemaTarget {
  name: string
  rootRelativePath: string
  absolutePath: string
}

function requireSchemaName(value: string, field: 'name' | 'source' | 'schema'): string {
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error(`Invalid Schema ${field}: expected a kebab-case project Schema name.`)
  }
  return value
}

/** Parse one Schema action before any Root Context, CLI, or filesystem operation begins. */
export function parseSchemaMutationAction(action: unknown): SchemaMutationAction {
  return SchemaMutationActionSchema.parse(action)
}

function schemaRootRelativePath(name: string): string {
  return `openspec/schemas/${name}`
}

function requireDescendantPath(rootPath: string, candidatePath: string, label: string): string {
  const relativePath = relative(resolve(rootPath), resolve(candidatePath)).replace(/\\/g, '/')
  if (relativePath.length === 0 || relativePath.startsWith('../') || relativePath === '..') {
    throw new Error(`${label} must resolve inside the selected project Schema root.`)
  }
  return requireOpenSpecEntityRelativePath(relativePath, 'path')
}

/**
 * Physical/reactive owner for the project Schema subtree of one selected Planning root.
 *
 * The pre-write physical checks supplied by Core cannot eliminate replacement races or identify
 * hard-link aliases; this owner deliberately reports no stronger filesystem confinement claim.
 */
export class SchemaMutationService {
  private readonly planningRoot: string

  constructor(private readonly options: SchemaMutationServiceOptions) {
    this.planningRoot = resolve(options.planningRoot)
  }

  /** Run one typed Schema action and return CLI evidence only for init/fork operations. */
  async mutate(input: SchemaMutationAction): Promise<CliResult | null> {
    const action = parseSchemaMutationAction(input)
    return match(action)
      .with({ action: 'init' }, (value) =>
        this.runSchemaCommand(requireSchemaName(value.name, 'name'), [
          'schema',
          'init',
          value.name,
          '--json',
          '--no-default',
        ])
      )
      .with({ action: 'fork' }, (value) =>
        this.runSchemaCommand(requireSchemaName(value.name, 'name'), [
          'schema',
          'fork',
          requireSchemaName(value.source, 'source'),
          value.name,
          '--json',
        ])
      )
      .with({ action: 'write-yaml' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: `${target.rootRelativePath}/schema.yaml`,
          content: value.content,
        })
        return null
      })
      .with({ action: 'write-file' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, value.path),
          content: value.content,
        })
        return null
      })
      .with({ action: 'create-file' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, value.path),
          content: value.content ?? '',
        })
        return null
      })
      .with({ action: 'create-directory' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await createPhysicalReactiveDirectory({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, value.path),
        })
        return null
      })
      .with({ action: 'delete-entry' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await removePhysicalReactivePath({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, value.path),
        })
        return null
      })
      .with({ action: 'write-template' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await this.options.kernel.ensureTemplates(target.name)
        const template = this.options.kernel.getTemplates(target.name)[value.artifactId]
        if (!template) {
          throw new Error(`Template not found for ${target.name}:${value.artifactId}.`)
        }
        if (template.source !== 'project') {
          throw new Error(
            `Template is read-only (${template.source} source); only project Schema templates are writable.`
          )
        }
        const templateRelativePath = requireDescendantPath(
          target.absolutePath,
          template.path,
          'Template path'
        )
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: `${target.rootRelativePath}/${templateRelativePath}`,
          content: value.content,
        })
        return null
      })
      .with({ action: 'delete-schema' }, async (value) => {
        const target = await this.projectSchemaTarget(value.schema)
        await removePhysicalReactivePath({
          rootPath: this.planningRoot,
          relativePath: target.rootRelativePath,
        })
        return null
      })
      .exhaustive()
  }

  private async runSchemaCommand(name: string, args: string[]): Promise<CliResult> {
    return runPhysicalReactivePathMutation(
      {
        rootPath: this.planningRoot,
        relativePath: schemaRootRelativePath(name),
      },
      () => this.options.cliExecutor.execute(args)
    )
  }

  private async projectSchemaTarget(schema: string): Promise<ProjectSchemaTarget> {
    const name = requireSchemaName(schema, 'schema')
    await this.options.kernel.ensureSchemaResolution(name)
    const resolution = this.options.kernel.getSchemaResolution(name)
    if (resolution.source !== 'project') {
      throw new Error(
        `Schema is read-only (${resolution.source} source); only project Schemas are writable.`
      )
    }

    const rootRelativePath = schemaRootRelativePath(name)
    const absolutePath = resolve(this.planningRoot, rootRelativePath)
    if (resolve(resolution.path) !== absolutePath) {
      throw new Error('Project Schema resolution escaped the selected Planning root.')
    }
    return { name, rootRelativePath, absolutePath }
  }

  private entryRelativePath(target: ProjectSchemaTarget, entryPath: string): string {
    return `${target.rootRelativePath}/${requireOpenSpecEntityRelativePath(entryPath, 'path')}`
  }
}
