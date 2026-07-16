/**
 * Orthogonal intents (updated 2026-07-16 Asia/Shanghai):
 * 1. Keep beta Store UI projections lenient and independent from strict CLI command contracts.
 * 2. Classify projection compatibility failures without crashing legacy Store UI.
 * 3. Preserve complete typed CLI evidence through every beta projection outcome.
 *
 * Original request (2026-07-15): "为不同命令建立强类型适配器，不实现平行解析规则。"
 */
import { z } from 'zod'
import type { CliCommandResult } from './cli-contracts/index.js'

/**
 * Beta feature fault-tolerance model (manager directive).
 *
 * 对于 beta 功能，openspecui 不负责兼容性。但这也意味着所有功能在后台需要有较强的容错能力
 * （没有这个功能也要能捕捉到错误），然后前端显示这个错误。这个错误一般是两种：
 *
 *  1. 数据不兼容 — 当前的 openspecui 不支持/不兼容 openspec-cli 提供的数据。通过 zod 对 CLI
 *     输出做宽松验证，所以除非 openspec-cli 破坏性更新提供了不兼容的数据结构，我们才会异常。
 *     → 前端处理：客观显示错误，并提供错误的版本来源信息（版本信息非常重要）。
 *
 *  2. 指令用法变了 — openspec-cli 直接修改了指令的用法，属于 openspec 上了比较大的破坏性更新。
 *     → 前端处理：直接隐藏入口（对弱 beta 入口而言）。
 *
 * 不论哪种情况，前端都不能因此崩溃。
 *
 * Stores (OpenSpec 1.5.0, very early beta) 是这个范式的首个落地：它是个很弱的入口——低版本
 * 没有、当前版本不稳定，因此异常一只需客观显示版本信息，异常二直接隐藏入口即可。
 *
 * Spec: openspec-cli-integration › "Beta Feature Fault Tolerance".
 */

const StoreDiagnosticSchema = z
  .object({
    severity: z.string().optional(),
    code: z.string().optional(),
    message: z.string().optional(),
    target: z.string().optional(),
    fix: z.string().optional(),
  })
  .passthrough()

const StoreListEntrySchema = z
  .object({
    id: z.string(),
    root: z.string(),
  })
  .passthrough()

/** Lenient beta projection of `openspec store list --json`. */
export const StoreListResultSchema = z
  .object({
    stores: z.array(StoreListEntrySchema).default([]),
    status: z.array(StoreDiagnosticSchema).optional(),
  })
  .passthrough()

const StoreOpenSpecRootSchema = z
  .object({
    present: z.boolean().nullable().optional(),
    healthy: z.boolean().nullable().optional(),
  })
  .passthrough()

const StoreMetadataSchema = z
  .object({
    present: z.boolean().nullable().optional(),
    valid: z.boolean().nullable().optional(),
    id: z.string().nullable().optional(),
    remote: z.string().nullable().optional(),
  })
  .passthrough()

const StoreGitFactsSchema = z
  .object({
    is_repository: z.boolean().nullable().optional(),
    has_commits: z.boolean().nullable().optional(),
    has_uncommitted_changes: z.boolean().nullable().optional(),
    has_remote: z.boolean().nullable().optional(),
    origin_url: z.string().nullable().optional(),
  })
  .passthrough()

const StoreDoctorStoreSchema = z
  .object({
    id: z.string().optional(),
    root: z.string().optional(),
    metadata_path: z.string().nullable().optional(),
    openspec_root: StoreOpenSpecRootSchema.optional(),
    metadata: StoreMetadataSchema.optional(),
    git: StoreGitFactsSchema.optional(),
    status: z.array(StoreDiagnosticSchema).optional(),
  })
  .passthrough()

/** Lenient beta projection of `openspec store doctor [id] --json`. */
export const StoreDoctorResultSchema = z
  .object({
    stores: z.array(StoreDoctorStoreSchema).default([]),
    status: z.array(StoreDiagnosticSchema).optional(),
  })
  .passthrough()

export type StoreListEntry = z.infer<typeof StoreListEntrySchema>
export type StoreDoctorStore = z.infer<typeof StoreDoctorStoreSchema>
export type StoreListResult = z.infer<typeof StoreListResultSchema>
export type StoreDoctorResult = z.infer<typeof StoreDoctorResultSchema>
export type StoreDiagnostic = z.infer<typeof StoreDiagnosticSchema>
/** Complete process and typed payload evidence for one Store-family CLI command. */
export type StoreCommandEvidence = CliCommandResult<Record<string, unknown>>

// ---------------------------------------------------------------------------
// Fault-tolerance error classification
// ---------------------------------------------------------------------------

/**
 * 异常一：数据不兼容。
 * CLI 命令成功执行（exit 0），但返回的数据结构 openspecui 无法解析（zod 宽松验证仍失败）。
 * 这是 openspec-cli 提供了不兼容数据结构的破坏性更新。前端应客观显示错误 + 版本来源信息。
 */
export type StoreDataIncompatibleError = {
  kind: 'data-incompatible'
  message: string
  cliVersion?: string
}

/**
 * 异常二：指令用法变了 / 指令缺失。
 * openspec-cli 直接修改了指令用法（非零退出、找不到子命令等），属于较大的破坏性更新。
 * 对弱 beta 入口，前端直接隐藏入口。
 */
export type StoreCommandUnavailableError = {
  kind: 'command-unavailable'
  message: string
  cliVersion?: string
}

/** 统一的 beta 功能错误载荷，两种异常都携带版本来源信息。 */
export type StoreFeatureError = StoreDataIncompatibleError | StoreCommandUnavailableError

/**
 * 一个 beta 功能端点的统一返回型。后端永不抛未捕获错误：成功返回 stores，失败返回结构化的
 * error（含异常类型与 cliVersion），available 标志该功能在当前 CLI 下是否可用。
 */
export type StoreFeatureResult<T = StoreListEntry[]> = {
  available: boolean
  stores: T
  evidence: StoreCommandEvidence | null
  error?: StoreFeatureError
  cliVersion?: string
}

/**
 * 把一次 CLI 调用的原始结果归类为三种状态之一（范式核心判定逻辑）。
 *
 * 判定规则：
 *  - exit 0 且 zod 宽松验证通过 → 'ok'
 *  - exit 0 但 zod 失败 → 'data-incompatible'（异常一）
 *  - 非 0 退出 / spawn 失败 → 'command-unavailable'（异常二）
 */
export type StoreClassification<T> =
  | { kind: 'ok'; data: T; evidence: StoreCommandEvidence }
  | (StoreFeatureError & { evidence: StoreCommandEvidence })

/** Classify a typed CLI result while projecting its already parsed payload leniently. */
export function classifyStoreCliResult<TSchema extends z.ZodTypeAny>(input: {
  result: StoreCommandEvidence
  schema: TSchema
  cliVersion?: string
}): StoreClassification<z.output<TSchema>> {
  const { result, schema, cliVersion } = input

  // 异常二：指令用法变了 / 指令缺失。CLI 没有按预期执行（非零退出或 spawn 失败）。
  if (!result.success) {
    return {
      kind: 'command-unavailable',
      message:
        result.stderr.trim() ||
        result.diagnostics.map((diagnostic) => diagnostic.message).join('\n') ||
        result.contractError ||
        'OpenSpec CLI store command failed or is unavailable.',
      evidence: result,
      ...(cliVersion ? { cliVersion } : {}),
    }
  }

  const projected = schema.safeParse(result.payload)
  if (projected.success) {
    return { kind: 'ok', data: projected.data, evidence: result }
  }

  return {
    kind: 'data-incompatible',
    message: `OpenSpec CLI returned an incompatible stores payload: ${result.contractError ?? projected.error.message}`,
    evidence: result,
    ...(cliVersion ? { cliVersion } : {}),
  }
}

/**
 * 把归类结果转换成端点返回型。成功时 stores = data，失败时 stores = fallback（通常是空数组）
 * 并附上 error。始终尽力带上 cliVersion（版本信息非常重要）。
 */
export function toStoreFeatureResult<T, TData>(
  classification: StoreClassification<TData>,
  options: { fromData: (data: TData) => T; fallback: T; cliVersion?: string }
): StoreFeatureResult<T> {
  const cliVersion = options.cliVersion
  if (classification.kind === 'ok') {
    return {
      available: true,
      stores: options.fromData(classification.data),
      evidence: classification.evidence,
      ...(cliVersion ? { cliVersion } : {}),
    }
  }

  const error: StoreFeatureError = {
    kind: classification.kind,
    message: classification.message,
    ...(classification.cliVersion ? { cliVersion: classification.cliVersion } : {}),
  }
  return {
    available: false,
    stores: options.fallback,
    evidence: classification.evidence,
    error,
    ...(cliVersion ? { cliVersion } : {}),
  }
}
