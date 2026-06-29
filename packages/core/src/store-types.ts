import { z } from 'zod'

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

// ---------------------------------------------------------------------------
// Lenient zod schemas
// ---------------------------------------------------------------------------
//
// 宽松验证：用 .passthrough() 容忍 CLI 新增字段，关键字段可选。这样 openspec-cli 的非破坏性
// （加字段）更新不会误报为异常一；只有真正破坏性的数据结构变更才会让解析失败。

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

export const StoreDoctorResultSchema = z
  .object({
    stores: z.array(StoreDoctorStoreSchema).default([]),
    status: z.array(StoreDiagnosticSchema).optional(),
  })
  .passthrough()

// ---------------------------------------------------------------------------
// Public lenient field types (inferred; all extra fields tolerated)
// ---------------------------------------------------------------------------

export type StoreListEntry = z.infer<typeof StoreListEntrySchema>
export type StoreDoctorStore = z.infer<typeof StoreDoctorStoreSchema>
export type StoreListResult = z.infer<typeof StoreListResultSchema>
export type StoreDoctorResult = z.infer<typeof StoreDoctorResultSchema>
export type StoreDiagnostic = z.infer<typeof StoreDiagnosticSchema>

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
export type StoreClassification = { kind: 'ok'; data: unknown } | StoreFeatureError

export function classifyStoreCliOutput(input: {
  success: boolean
  stdout: string
  stderr: string
  parse: (stdout: string) => unknown
  cliVersion?: string
}): StoreClassification {
  const { success, stdout, stderr, parse, cliVersion } = input

  // 异常二：指令用法变了 / 指令缺失。CLI 没有按预期执行（非零退出或 spawn 失败）。
  if (!success) {
    return {
      kind: 'command-unavailable',
      message: stderr.trim() || 'OpenSpec CLI store command failed or is unavailable.',
      ...(cliVersion ? { cliVersion } : {}),
    }
  }

  // exit 0：尝试宽松解析。
  try {
    const data = parse(stdout)
    return { kind: 'ok', data }
  } catch (error) {
    // 异常一：数据不兼容。命令成功了，但返回的数据结构 openspecui 解析不了。
    const message = error instanceof Error ? error.message : String(error)
    return {
      kind: 'data-incompatible',
      message: `OpenSpec CLI returned an incompatible stores payload: ${message}`,
      ...(cliVersion ? { cliVersion } : {}),
    }
  }
}

/**
 * 把归类结果转换成端点返回型。成功时 stores = data，失败时 stores = fallback（通常是空数组）
 * 并附上 error。始终尽力带上 cliVersion（版本信息非常重要）。
 */
export function toStoreFeatureResult<T>(
  classification: StoreClassification,
  options: { fromData: (data: unknown) => T; fallback: T; cliVersion?: string }
): StoreFeatureResult<T> {
  const cliVersion = options.cliVersion
  if (classification.kind === 'ok') {
    return {
      available: true,
      stores: options.fromData(classification.data),
      ...(cliVersion ? { cliVersion } : {}),
    }
  }

  return {
    available: false,
    stores: options.fallback,
    error: classification,
    ...(cliVersion ? { cliVersion } : {}),
  }
}
