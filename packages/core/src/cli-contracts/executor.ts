/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Build root-aware read and workflow command argv.
 * 2. Build Store inspection and mutation argv through the official CLI surface.
 * 3. Build strict validate/archive argv without implicit recovery behavior.
 * 4. Parse every invocation, including Archive Instructions, through its command-specific evidence schema.
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 */
import type { z } from 'zod'
import type { CliResult } from '../cli-executor.js'
import { parseCliCommandResult, type CliCommandResult } from './command-result.js'
import { CliSchemasSchema, type CliSchemas } from './schema-resolution.js'
import {
  CliContextSchema,
  CliDoctorSchema,
  CliStoreCleanupSchema,
  CliStoreDoctorSchema,
  CliStoreListSchema,
  CliStoreMutationSchema,
  type CliContext,
  type CliDoctor,
  type CliStoreCleanup,
  type CliStoreDoctor,
  type CliStoreList,
  type CliStoreMutation,
} from './store.js'
import {
  CliApplyInstructionsSchema,
  CliArchiveInstructionsSchema,
  CliArchiveSchema,
  CliArtifactInstructionsSchema,
  CliChangeListSchema,
  CliSchemaWhichSchema,
  CliShowSpecSchema,
  CliSpecListSchema,
  CliTemplatesSchema,
  CliValidateSchema,
  CliWorkflowStatusSchema,
  type CliApplyInstructions,
  type CliArchive,
  type CliArchiveInstructions,
  type CliArtifactInstructions,
  type CliChangeList,
  type CliSchemaWhich,
  type CliShowSpec,
  type CliSpecList,
  type CliTemplates,
  type CliValidate,
  type CliWorkflowStatus,
} from './workflow.js'

/** Root selection arguments shared by root-aware OpenSpec CLI commands. */
export interface CliRootSelector {
  /** Explicit Store selector. Presence is significant; the CLI validates empty values. */
  store?: string
}

/** Workflow Status/Instructions selectors passed through to the official CLI. */
export interface CliWorkflowOptions extends CliRootSelector {
  /** Explicit workflow schema selector passed to the official CLI. */
  schema?: string
}

/** Options for creating a Store through the official CLI. */
export interface CliStoreSetupOptions {
  /** Filesystem path where the official CLI creates the Store. */
  path: string
  /** Whether the official CLI initializes Git for the Store. */
  initGit?: boolean
  /** Optional remote recorded by the official CLI. */
  remote?: string
}

/** Options for registering an existing Store through the official CLI. */
export interface CliStoreRegisterOptions {
  /** Optional Store identity override validated by the official CLI. */
  id?: string
  /** Confirm a Store identity mismatch through the official CLI. */
  confirmIdentity?: boolean
}

/** Options for removing a Store through the official CLI. */
export interface CliStoreRemoveOptions {
  /** Confirm destructive Store checkout deletion through the official CLI. */
  confirmDelete?: boolean
}

/** Validate target expressed without reconstructing CLI positional arguments at call sites. */
export type CliValidateTarget =
  | { kind: 'item'; id: string; type?: 'change' | 'spec' }
  | { kind: 'scope'; scope: 'all' | 'changes' | 'specs' }
  /** OpenSpec 1.9 archived-task validation over the resolved root's archive. */
  | { kind: 'archived' }

/** JSON Validate options, including explicit target and root selection. */
export interface CliValidateJsonOptions extends CliRootSelector {
  target: CliValidateTarget
  strict?: boolean
}

type ExecuteCli = (args: string[]) => Promise<CliResult>

/** Typed OpenSpec 1.6 command facade over the raw process executor. */
export class OpenSpecCliContractExecutor {
  constructor(private readonly executeCli: ExecuteCli) {}

  private async execute<T>(args: string[], schema: z.ZodType<T>): Promise<CliCommandResult<T>> {
    return parseCliCommandResult(await this.executeCli(args), schema)
  }

  private withRoot(args: string[], selector: CliRootSelector = {}): string[] {
    if (selector.store !== undefined) args.push('--store', selector.store)
    return args
  }

  private withWorkflowOptions(args: string[], options: CliWorkflowOptions = {}): string[] {
    if (options.schema !== undefined) args.push('--schema', options.schema)
    return this.withRoot(args, options)
  }

  /** List changes in the CLI-selected planning root. */
  async listChanges(selector: CliRootSelector = {}): Promise<CliCommandResult<CliChangeList>> {
    return this.execute(this.withRoot(['list', '--json'], selector), CliChangeListSchema)
  }

  /** List owned or explicitly selected Store Specs through the official CLI. */
  async listSpecs(selector: CliRootSelector = {}): Promise<CliCommandResult<CliSpecList>> {
    return this.execute(this.withRoot(['list', '--specs', '--json'], selector), CliSpecListSchema)
  }

  /** Read one owned or explicitly selected Store Spec through the official CLI. */
  async showSpec(
    specId: string,
    selector: CliRootSelector = {}
  ): Promise<CliCommandResult<CliShowSpec>> {
    return this.execute(
      this.withRoot(['show', specId, '--type', 'spec', '--json'], selector),
      CliShowSpecSchema
    )
  }

  /** List workflow schemas through the CLI JSON contract. */
  async schemas(): Promise<CliCommandResult<CliSchemas>> {
    return this.execute(['schemas', '--json'], CliSchemasSchema)
  }

  /** Resolve one workflow schema through the CLI JSON contract. */
  async schemaWhich(name: string): Promise<CliCommandResult<CliSchemaWhich>> {
    return this.execute(['schema', 'which', name, '--json'], CliSchemaWhichSchema)
  }

  /** List the resolved template index through the CLI JSON contract. */
  async templates(schema?: string): Promise<CliCommandResult<CliTemplates>> {
    const args = ['templates', '--json']
    if (schema !== undefined) args.push('--schema', schema)
    return this.execute(args, CliTemplatesSchema)
  }

  /** Read complete workflow Status evidence for one change. */
  async workflowStatus(
    changeId: string,
    options: CliWorkflowOptions = {}
  ): Promise<CliCommandResult<CliWorkflowStatus>> {
    return this.execute(
      this.withWorkflowOptions(['status', '--change', changeId, '--json'], options),
      CliWorkflowStatusSchema
    )
  }

  /** Read complete Instructions evidence for one workflow artifact. */
  async artifactInstructions(
    changeId: string,
    artifactId: string,
    options: CliWorkflowOptions = {}
  ): Promise<CliCommandResult<CliArtifactInstructions>> {
    return this.execute(
      this.withWorkflowOptions(
        ['instructions', artifactId, '--change', changeId, '--json'],
        options
      ),
      CliArtifactInstructionsSchema
    )
  }

  /** Read complete Apply Instructions evidence for one change. */
  async applyInstructions(
    changeId: string,
    options: CliWorkflowOptions = {}
  ): Promise<CliCommandResult<CliApplyInstructions>> {
    return this.execute(
      this.withWorkflowOptions(['instructions', 'apply', '--change', changeId, '--json'], options),
      CliApplyInstructionsSchema
    )
  }

  /** Read complete Archive Instructions evidence for one change. */
  async archiveInstructions(
    changeId: string,
    options: CliWorkflowOptions = {}
  ): Promise<CliCommandResult<CliArchiveInstructions>> {
    return this.execute(
      this.withWorkflowOptions(
        ['instructions', 'archive', '--change', changeId, '--json'],
        options
      ),
      CliArchiveInstructionsSchema
    )
  }

  /** Inspect selected-root, Store, and Reference health through CLI Doctor. */
  async doctorRoot(selector: CliRootSelector = {}): Promise<CliCommandResult<CliDoctor>> {
    return this.execute(this.withRoot(['doctor', '--json'], selector), CliDoctorSchema)
  }

  /** Read the selected root and its direct Reference relationships. */
  async context(selector: CliRootSelector = {}): Promise<CliCommandResult<CliContext>> {
    return this.execute(this.withRoot(['context', '--json'], selector), CliContextSchema)
  }

  /** List Stores registered in the effective OpenSpec runtime environment. */
  async listStores(): Promise<CliCommandResult<CliStoreList>> {
    return this.execute(['store', 'list', '--json'], CliStoreListSchema)
  }

  /** Inspect all Stores or one explicitly present Store id. */
  async doctorStores(id?: string): Promise<CliCommandResult<CliStoreDoctor>> {
    const args = ['store', 'doctor']
    if (id !== undefined) args.push(id)
    args.push('--json')
    return this.execute(args, CliStoreDoctorSchema)
  }

  /** Create and register a Store through the official CLI. */
  async setupStore(
    id: string,
    options: CliStoreSetupOptions
  ): Promise<CliCommandResult<CliStoreMutation>> {
    const args = ['store', 'setup', id, '--path', options.path]
    if (options.initGit === true) args.push('--init-git')
    if (options.initGit === false) args.push('--no-init-git')
    if (options.remote !== undefined) args.push('--remote', options.remote)
    args.push('--json')
    return this.execute(args, CliStoreMutationSchema)
  }

  /** Register an existing Store root through the official CLI. */
  async registerStore(
    path: string,
    options: CliStoreRegisterOptions = {}
  ): Promise<CliCommandResult<CliStoreMutation>> {
    const args = ['store', 'register', path]
    if (options.id !== undefined) args.push('--id', options.id)
    if (options.confirmIdentity) args.push('--yes')
    args.push('--json')
    return this.execute(args, CliStoreMutationSchema)
  }

  /** Remove one Store registry entry without deleting its checkout. */
  async unregisterStore(id: string): Promise<CliCommandResult<CliStoreCleanup>> {
    return this.execute(['store', 'unregister', id, '--json'], CliStoreCleanupSchema)
  }

  /** Remove one Store through the official CLI destructive boundary. */
  async removeStore(
    id: string,
    options: CliStoreRemoveOptions = {}
  ): Promise<CliCommandResult<CliStoreCleanup>> {
    const args = ['store', 'remove', id]
    if (options.confirmDelete) args.push('--yes')
    args.push('--json')
    return this.execute(args, CliStoreCleanupSchema)
  }

  /** Validate an item, scope, or the archive without inferring retries or readiness. */
  async validate(options: CliValidateJsonOptions): Promise<CliCommandResult<CliValidate>> {
    const args = ['validate']
    if (options.target.kind === 'item') {
      args.push(options.target.id)
      if (options.target.type) args.push('--type', options.target.type)
    } else if (options.target.kind === 'scope') {
      args.push(`--${options.target.scope}`)
    } else {
      args.push('--archived')
    }
    if (options.strict) args.push('--strict')
    args.push('--json')
    return this.execute(this.withRoot(args, options), CliValidateSchema)
  }

  /** Archive one change without implicit validation bypass or retry. */
  async archive(
    changeId: string,
    options: CliRootSelector & { skipSpecs?: boolean; noValidate?: boolean } = {}
  ): Promise<CliCommandResult<CliArchive>> {
    const args = ['archive', changeId, '--json', '--yes']
    if (options.skipSpecs) args.push('--skip-specs')
    if (options.noValidate) args.push('--no-validate')
    return this.execute(this.withRoot(args, options), CliArchiveSchema)
  }
}
