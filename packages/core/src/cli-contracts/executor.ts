/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Build root-aware read and workflow command argv.
 * 2. Build Store inspection and mutation argv through the official CLI surface.
 * 3. Build strict validate/archive argv without implicit recovery behavior.
 * 4. Parse every invocation, including Archive Instructions, through its command-specific evidence schema.

 * 5. Forward the selected Root selector only where the admitted CLI declares it.
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"

 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 */
import type { z } from 'zod'
import type { CliResult } from '../cli-executor.js'
import type { OpenSpecCliCapabilities } from '../openspec-compat.js'
import { CliBatchStatusSchema, type CliBatchStatus } from './batch-status.js'
import { parseCliCommandResult, type CliCommandResult } from './command-result.js'
import { CliSchemasSchema, type CliSchemas } from './schema-resolution.js'
import { CliShowChangeDiffSchema, type CliShowChangeDiff } from './show-diff.js'
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

/**
 * Result of a capability-gated command: either executed evidence or a typed refusal.
 *
 * A refusal means the admitted CLI never declares the command (`status --all` and
 * `show --diff` are OpenSpec 1.11 only), so no argv is constructed at all. The
 * caller resolves capabilities once per session through the existing injection
 * pattern (see `OpsxKernel.resolveCliCapabilities`) and passes them in.
 */
export type CliGatedCommandResult<T> =
  | { kind: 'executed'; result: CliCommandResult<T> }
  | { kind: 'unavailable'; capability: 'batchStatus' | 'requirementDiff' }

/** Options for the OpenSpec 1.11 batch Status command. */
export interface CliWorkflowStatusAllOptions extends CliWorkflowOptions {
  /** Capabilities of the admitted CLI; `batchStatus` must be true to construct argv. */
  capabilities: Pick<OpenSpecCliCapabilities, 'batchStatus'>
}

/** Options for the OpenSpec 1.11 show-change diff command. */
export interface CliShowChangeDiffOptions extends CliRootSelector {
  /** Capabilities of the admitted CLI; `requirementDiff` must be true to construct argv. */
  capabilities: Pick<OpenSpecCliCapabilities, 'requirementDiff'>
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

  /** List workflow schemas through the CLI JSON contract with the selected Root's Store selector. */
  async schemas(selector: CliRootSelector = {}): Promise<CliCommandResult<CliSchemas>> {
    return this.execute(this.withRoot(['schemas', '--json'], selector), CliSchemasSchema)
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

  /**
   * Read every active change's Status evidence in one spawn (OpenSpec 1.11 only).
   *
   * Gated by the `batchStatus` capability because OpenSpec 1.10 rejects the
   * `--all` flag. The batch envelope decodes from stdout regardless of exit
   * code: per-change failures live inside the sum-type entries, and only an
   * unparseable stdout document is a contract error.
   */
  async workflowStatusAll(
    options: CliWorkflowStatusAllOptions
  ): Promise<CliGatedCommandResult<CliBatchStatus>> {
    if (!options.capabilities.batchStatus) {
      return { kind: 'unavailable', capability: 'batchStatus' }
    }
    return {
      kind: 'executed',
      result: await this.execute(
        this.withWorkflowOptions(['status', '--all', '--json'], options),
        CliBatchStatusSchema
      ),
    }
  }

  /**
   * Read one change's delta evidence with MODIFIED-only requirement diffs
   * (OpenSpec 1.11 only). Gated by the `requirementDiff` capability because
   * OpenSpec 1.10 rejects the `--diff` flag; the diff is CLI-owned evidence
   * and is never recomputed locally.
   */
  async showChangeDiff(
    changeId: string,
    options: CliShowChangeDiffOptions
  ): Promise<CliGatedCommandResult<CliShowChangeDiff>> {
    if (!options.capabilities.requirementDiff) {
      return { kind: 'unavailable', capability: 'requirementDiff' }
    }
    return {
      kind: 'executed',
      result: await this.execute(
        this.withRoot(['show', changeId, '--json', '--diff'], options),
        CliShowChangeDiffSchema
      ),
    }
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
