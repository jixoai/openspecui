/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Build root-aware read and workflow command argv.
 * 2. Build Store inspection and mutation argv through the official CLI surface.
 * 3. Build strict validate/archive argv without implicit recovery behavior.
 * 4. Parse every invocation through its command-specific evidence schema.
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 */
import type { z } from 'zod'
import type { CliResult } from '../cli-executor.js'
import { parseCliCommandResult, type CliCommandResult } from './command-result.js'
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
  CliArchiveSchema,
  CliArtifactInstructionsSchema,
  CliChangeListSchema,
  CliShowSpecSchema,
  CliSpecListSchema,
  CliValidateSchema,
  CliWorkflowStatusSchema,
  type CliApplyInstructions,
  type CliArchive,
  type CliArtifactInstructions,
  type CliChangeList,
  type CliShowSpec,
  type CliSpecList,
  type CliValidate,
  type CliWorkflowStatus,
} from './workflow.js'

export interface CliRootSelector {
  store?: string
}

export interface CliStoreSetupOptions {
  path: string
  initGit?: boolean
  remote?: string
}

export interface CliStoreRegisterOptions {
  id?: string
  confirmIdentity?: boolean
}

export interface CliStoreRemoveOptions {
  confirmDelete?: boolean
}

export type CliValidateTarget =
  | { kind: 'item'; id: string; type?: 'change' | 'spec' }
  | { kind: 'scope'; scope: 'all' | 'changes' | 'specs' }

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
    if (selector.store) args.push('--store', selector.store)
    return args
  }

  async listChanges(selector: CliRootSelector = {}): Promise<CliCommandResult<CliChangeList>> {
    return this.execute(this.withRoot(['list', '--json'], selector), CliChangeListSchema)
  }

  async listSpecs(selector: CliRootSelector = {}): Promise<CliCommandResult<CliSpecList>> {
    return this.execute(this.withRoot(['list', '--specs', '--json'], selector), CliSpecListSchema)
  }

  async showSpec(
    specId: string,
    selector: CliRootSelector = {}
  ): Promise<CliCommandResult<CliShowSpec>> {
    return this.execute(
      this.withRoot(['show', specId, '--type', 'spec', '--json'], selector),
      CliShowSpecSchema
    )
  }

  async workflowStatus(
    changeId: string,
    selector: CliRootSelector = {}
  ): Promise<CliCommandResult<CliWorkflowStatus>> {
    return this.execute(
      this.withRoot(['status', '--change', changeId, '--json'], selector),
      CliWorkflowStatusSchema
    )
  }

  async artifactInstructions(
    changeId: string,
    artifactId: string,
    selector: CliRootSelector = {}
  ): Promise<CliCommandResult<CliArtifactInstructions>> {
    return this.execute(
      this.withRoot(['instructions', artifactId, '--change', changeId, '--json'], selector),
      CliArtifactInstructionsSchema
    )
  }

  async applyInstructions(
    changeId: string,
    selector: CliRootSelector = {}
  ): Promise<CliCommandResult<CliApplyInstructions>> {
    return this.execute(
      this.withRoot(['instructions', 'apply', '--change', changeId, '--json'], selector),
      CliApplyInstructionsSchema
    )
  }

  async doctorRoot(selector: CliRootSelector = {}): Promise<CliCommandResult<CliDoctor>> {
    return this.execute(this.withRoot(['doctor', '--json'], selector), CliDoctorSchema)
  }

  async context(selector: CliRootSelector = {}): Promise<CliCommandResult<CliContext>> {
    return this.execute(this.withRoot(['context', '--json'], selector), CliContextSchema)
  }

  async listStores(): Promise<CliCommandResult<CliStoreList>> {
    return this.execute(['store', 'list', '--json'], CliStoreListSchema)
  }

  async doctorStores(id?: string): Promise<CliCommandResult<CliStoreDoctor>> {
    const args = ['store', 'doctor']
    if (id) args.push(id)
    args.push('--json')
    return this.execute(args, CliStoreDoctorSchema)
  }

  async setupStore(
    id: string,
    options: CliStoreSetupOptions
  ): Promise<CliCommandResult<CliStoreMutation>> {
    const args = ['store', 'setup', id, '--path', options.path]
    if (options.initGit === true) args.push('--init-git')
    if (options.initGit === false) args.push('--no-init-git')
    if (options.remote) args.push('--remote', options.remote)
    args.push('--json')
    return this.execute(args, CliStoreMutationSchema)
  }

  async registerStore(
    path: string,
    options: CliStoreRegisterOptions = {}
  ): Promise<CliCommandResult<CliStoreMutation>> {
    const args = ['store', 'register', path]
    if (options.id) args.push('--id', options.id)
    if (options.confirmIdentity) args.push('--yes')
    args.push('--json')
    return this.execute(args, CliStoreMutationSchema)
  }

  async unregisterStore(id: string): Promise<CliCommandResult<CliStoreCleanup>> {
    return this.execute(['store', 'unregister', id, '--json'], CliStoreCleanupSchema)
  }

  async removeStore(
    id: string,
    options: CliStoreRemoveOptions = {}
  ): Promise<CliCommandResult<CliStoreCleanup>> {
    const args = ['store', 'remove', id]
    if (options.confirmDelete) args.push('--yes')
    args.push('--json')
    return this.execute(args, CliStoreCleanupSchema)
  }

  async validate(options: CliValidateJsonOptions): Promise<CliCommandResult<CliValidate>> {
    const args = ['validate']
    if (options.target.kind === 'item') {
      args.push(options.target.id)
      if (options.target.type) args.push('--type', options.target.type)
    } else {
      args.push(`--${options.target.scope}`)
    }
    if (options.strict) args.push('--strict')
    args.push('--json')
    return this.execute(this.withRoot(args, options), CliValidateSchema)
  }

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
