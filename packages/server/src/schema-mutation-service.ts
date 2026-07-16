/**
 * Orthogonal intents (created 2026-07-17 Asia/Shanghai):
 * 1. Own typed project-Schema and Template mutations inside one Planning root.
 * 2. Delegate direct writes, creates, and deletes to the physical/reactive Core boundary.
 * 3. Run schema init/fork through a Planning-root-local CLI executor without Store selection.
 * 4. Keep user and package Schema sources explicitly read-only.
 *
 * Original request (2026-07-16): "Schema/Template mutations must reject symlink escape and settle reactive projections before success."
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

/** Typed project-Schema mutation accepted by the Planning-root owner. */
export type SchemaMutationAction =
  | { action: 'init'; name: string }
  | { action: 'fork'; source: string; name: string }
  | { action: 'write-yaml'; schema: string; content: string }
  | { action: 'write-file'; schema: string; path: string; content: string }
  | { action: 'create-file'; schema: string; path: string; content?: string }
  | { action: 'create-directory'; schema: string; path: string }
  | { action: 'delete-entry'; schema: string; path: string }
  | { action: 'write-template'; schema: string; artifactId: string; content: string }
  | { action: 'delete-schema'; schema: string }

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

function requireArtifactId(value: string): string {
  if (
    value.length === 0 ||
    value !== value.trim() ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new Error('Invalid Schema artifact id: expected one canonical path segment.')
  }
  return value
}

/** Reject an invalid Schema action before any Root Context, CLI, or filesystem operation begins. */
export function assertValidSchemaMutationAction(action: SchemaMutationAction): void {
  switch (action.action) {
    case 'init':
      requireSchemaName(action.name, 'name')
      return
    case 'fork':
      requireSchemaName(action.source, 'source')
      requireSchemaName(action.name, 'name')
      return
    case 'write-yaml':
    case 'delete-schema':
      requireSchemaName(action.schema, 'schema')
      return
    case 'write-file':
    case 'create-file':
    case 'create-directory':
    case 'delete-entry':
      requireSchemaName(action.schema, 'schema')
      requireOpenSpecEntityRelativePath(action.path, 'path')
      return
    case 'write-template':
      requireSchemaName(action.schema, 'schema')
      requireArtifactId(action.artifactId)
      return
  }
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
  async mutate(action: SchemaMutationAction): Promise<CliResult | null> {
    assertValidSchemaMutationAction(action)
    switch (action.action) {
      case 'init':
        return this.runSchemaCommand(requireSchemaName(action.name, 'name'), [
          'schema',
          'init',
          action.name,
          '--json',
          '--no-default',
        ])
      case 'fork':
        return this.runSchemaCommand(requireSchemaName(action.name, 'name'), [
          'schema',
          'fork',
          requireSchemaName(action.source, 'source'),
          action.name,
          '--json',
        ])
      case 'write-yaml': {
        const target = await this.projectSchemaTarget(action.schema)
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: `${target.rootRelativePath}/schema.yaml`,
          content: action.content,
        })
        return null
      }
      case 'write-file': {
        const target = await this.projectSchemaTarget(action.schema)
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, action.path),
          content: action.content,
        })
        return null
      }
      case 'create-file': {
        const target = await this.projectSchemaTarget(action.schema)
        await writePhysicalReactiveFile({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, action.path),
          content: action.content ?? '',
        })
        return null
      }
      case 'create-directory': {
        const target = await this.projectSchemaTarget(action.schema)
        await createPhysicalReactiveDirectory({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, action.path),
        })
        return null
      }
      case 'delete-entry': {
        const target = await this.projectSchemaTarget(action.schema)
        await removePhysicalReactivePath({
          rootPath: this.planningRoot,
          relativePath: this.entryRelativePath(target, action.path),
        })
        return null
      }
      case 'write-template': {
        const target = await this.projectSchemaTarget(action.schema)
        await this.options.kernel.ensureTemplates(target.name)
        const template = this.options.kernel.getTemplates(target.name)[action.artifactId]
        if (!template) {
          throw new Error(`Template not found for ${target.name}:${action.artifactId}.`)
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
          content: action.content,
        })
        return null
      }
      case 'delete-schema': {
        const target = await this.projectSchemaTarget(action.schema)
        await removePhysicalReactivePath({
          rootPath: this.planningRoot,
          relativePath: target.rootRelativePath,
        })
        return null
      }
    }
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
