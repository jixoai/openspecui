/**
 * 工具配置检测模块
 *
 * 完全对齐 @fission-ai/openspec 的官方实现
 * 用于检测项目中已配置的 AI 工具
 *
 * 重要：使用响应式文件系统实现，监听配置目录，
 * 当配置文件变化时会自动触发更新。
 *
 * @see references/openspec/src/core/config.ts (AI_TOOLS)
 * @see references/openspec/src/core/configurators/slash/
 * @see references/openspec/src/core/init.ts (isToolConfigured)
 */

import { stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { ReactiveState, acquireWatcher } from './reactive-fs/index.js'

/**
 * 检测路径范围
 * - project: 相对于项目根目录
 * - global: 绝对路径（如 Codex 的 ~/.codex/prompts/）
 * - none: 无检测路径（如 Universal AGENTS.md 通过项目 AGENTS.md 检测）
 */
type DetectionScope = 'project' | 'global' | 'none'

/**
 * AI 工具选项（与官方 OpenSpec CLI 完全一致）
 * @see references/openspec/src/core/config.ts
 */
export interface AIToolOption {
  /** 显示名称 */
  name: string
  /** 工具 ID（用于 CLI 参数） */
  value: string
  /** 是否可用（available: false 的工具不会出现在主列表中） */
  available: boolean
  /** 成功消息中使用的标签 */
  successLabel?: string
}

/**
 * 工具检测配置
 */
export interface ToolDetectionConfig {
  /** 检测路径范围 */
  scope: DetectionScope
  /**
   * 检测路径
   * - scope='project': 相对于项目根目录的路径
   * - scope='global': 返回绝对路径的函数
   * - scope='none': undefined
   */
  detectionPath?: string | (() => string)
}

/**
 * 完整的工具配置（元信息 + 检测配置）
 */
export interface ToolConfig extends AIToolOption, ToolDetectionConfig {}

/**
 * 获取 Codex 全局 prompts 目录
 * 优先使用 $CODEX_HOME 环境变量，否则使用 ~/.codex
 * @see references/openspec/src/core/configurators/slash/codex.ts
 */
function getCodexGlobalPromptsDir(): string {
  const codexHome = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex')
  return join(codexHome, 'prompts')
}

/**
 * 所有支持的 AI 工具配置
 *
 * 完全对齐官方 OpenSpec CLI 的 AI_TOOLS
 * 按字母顺序排序（与官方一致）
 *
 * @see references/openspec/src/core/config.ts
 * @see references/openspec/src/core/configurators/slash/registry.ts
 */
export const AI_TOOLS: ToolConfig[] = [
  // Amazon Q Developer
  {
    name: 'Amazon Q Developer',
    value: 'amazon-q',
    available: true,
    successLabel: 'Amazon Q Developer',
    scope: 'project',
    detectionPath: '.amazonq/prompts/openspec-proposal.md',
  },

  // Antigravity
  {
    name: 'Antigravity',
    value: 'antigravity',
    available: true,
    successLabel: 'Antigravity',
    scope: 'project',
    detectionPath: '.agent/workflows/openspec-proposal.md',
  },

  // Auggie (Augment CLI)
  {
    name: 'Auggie (Augment CLI)',
    value: 'auggie',
    available: true,
    successLabel: 'Auggie',
    scope: 'project',
    detectionPath: '.augment/commands/openspec-proposal.md',
  },

  // Claude Code
  {
    name: 'Claude Code',
    value: 'claude',
    available: true,
    successLabel: 'Claude Code',
    scope: 'project',
    detectionPath: '.claude/commands/openspec/proposal.md',
  },

  // Cline
  {
    name: 'Cline',
    value: 'cline',
    available: true,
    successLabel: 'Cline',
    scope: 'project',
    detectionPath: '.clinerules/workflows/openspec-proposal.md',
  },

  // Codex (全局目录)
  {
    name: 'Codex',
    value: 'codex',
    available: true,
    successLabel: 'Codex',
    scope: 'global',
    detectionPath: () => join(getCodexGlobalPromptsDir(), 'openspec-proposal.md'),
  },

  // CodeBuddy Code (CLI)
  {
    name: 'CodeBuddy Code (CLI)',
    value: 'codebuddy',
    available: true,
    successLabel: 'CodeBuddy Code',
    scope: 'project',
    detectionPath: '.codebuddy/commands/openspec/proposal.md',
  },

  // CoStrict
  {
    name: 'CoStrict',
    value: 'costrict',
    available: true,
    successLabel: 'CoStrict',
    scope: 'project',
    detectionPath: '.cospec/openspec/commands/openspec-proposal.md',
  },

  // Crush
  {
    name: 'Crush',
    value: 'crush',
    available: true,
    successLabel: 'Crush',
    scope: 'project',
    detectionPath: '.crush/commands/openspec/proposal.md',
  },

  // Cursor
  {
    name: 'Cursor',
    value: 'cursor',
    available: true,
    successLabel: 'Cursor',
    scope: 'project',
    detectionPath: '.cursor/commands/openspec-proposal.md',
  },

  // Factory Droid
  {
    name: 'Factory Droid',
    value: 'factory',
    available: true,
    successLabel: 'Factory Droid',
    scope: 'project',
    detectionPath: '.factory/commands/openspec-proposal.md',
  },

  // Gemini CLI
  {
    name: 'Gemini CLI',
    value: 'gemini',
    available: true,
    successLabel: 'Gemini CLI',
    scope: 'project',
    detectionPath: '.gemini/commands/openspec/proposal.toml',
  },

  // GitHub Copilot
  {
    name: 'GitHub Copilot',
    value: 'github-copilot',
    available: true,
    successLabel: 'GitHub Copilot',
    scope: 'project',
    detectionPath: '.github/prompts/openspec-proposal.prompt.md',
  },

  // iFlow
  {
    name: 'iFlow',
    value: 'iflow',
    available: true,
    successLabel: 'iFlow',
    scope: 'project',
    detectionPath: '.iflow/commands/openspec-proposal.md',
  },

  // Kilo Code
  {
    name: 'Kilo Code',
    value: 'kilocode',
    available: true,
    successLabel: 'Kilo Code',
    scope: 'project',
    detectionPath: '.kilocode/workflows/openspec-proposal.md',
  },

  // OpenCode
  {
    name: 'OpenCode',
    value: 'opencode',
    available: true,
    successLabel: 'OpenCode',
    scope: 'project',
    detectionPath: '.opencode/command/openspec-proposal.md',
  },

  // Qoder (CLI)
  {
    name: 'Qoder (CLI)',
    value: 'qoder',
    available: true,
    successLabel: 'Qoder',
    scope: 'project',
    detectionPath: '.qoder/commands/openspec/proposal.md',
  },

  // Qwen Code
  {
    name: 'Qwen Code',
    value: 'qwen',
    available: true,
    successLabel: 'Qwen Code',
    scope: 'project',
    detectionPath: '.qwen/commands/openspec-proposal.toml',
  },

  // RooCode
  {
    name: 'RooCode',
    value: 'roocode',
    available: true,
    successLabel: 'RooCode',
    scope: 'project',
    detectionPath: '.roo/commands/openspec-proposal.md',
  },

  // Windsurf
  {
    name: 'Windsurf',
    value: 'windsurf',
    available: true,
    successLabel: 'Windsurf',
    scope: 'project',
    detectionPath: '.windsurf/workflows/openspec-proposal.md',
  },

  // Universal AGENTS.md（available: false，在 "Other tools" 分组中显示）
  // 通过项目根目录的 AGENTS.md 检测
  {
    name: 'AGENTS.md (works with Amp, VS Code, …)',
    value: 'agents',
    available: false,
    successLabel: 'your AGENTS.md-compatible assistant',
    scope: 'project',
    detectionPath: 'AGENTS.md',
  },
]

/**
 * 获取所有可用的工具（available: true）
 */
export function getAvailableTools(): ToolConfig[] {
  return AI_TOOLS.filter((tool) => tool.available)
}

/**
 * 获取所有可用的工具 ID 列表（available: true）
 */
export function getAvailableToolIds(): string[] {
  return getAvailableTools().map((tool) => tool.value)
}

/**
 * 获取所有工具（包括 available: false 的）
 */
export function getAllTools(): ToolConfig[] {
  return AI_TOOLS
}

/**
 * 获取所有工具 ID 列表（包括 available: false 的）
 */
export function getAllToolIds(): string[] {
  return AI_TOOLS.map((tool) => tool.value)
}

/**
 * 根据工具 ID 获取工具配置
 */
export function getToolById(toolId: string): ToolConfig | undefined {
  return AI_TOOLS.find((tool) => tool.value === toolId)
}

/** 状态缓存：projectDir -> ReactiveState */
const stateCache = new Map<string, ReactiveState<string[]>>()

/** 监听器释放函数缓存 */
const releaseCache = new Map<string, () => void>()

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * 解析工具的检测路径
 * @param config 工具配置
 * @param projectDir 项目根目录
 * @returns 绝对路径，如果无检测路径则返回 undefined
 */
function resolveDetectionPath(config: ToolConfig, projectDir: string): string | undefined {
  if (config.scope === 'none' || !config.detectionPath) {
    return undefined
  }
  if (config.scope === 'global') {
    // 全局路径：调用函数获取绝对路径
    return (config.detectionPath as () => string)()
  }
  // 项目路径：拼接项目根目录
  return join(projectDir, config.detectionPath as string)
}

/**
 * 扫描已配置的工具（并行检查）
 */
async function scanConfiguredTools(projectDir: string): Promise<string[]> {
  // 并行检查所有工具配置文件
  const results = await Promise.all(
    AI_TOOLS.map(async (config) => {
      const filePath = resolveDetectionPath(config, projectDir)
      if (!filePath) return null
      const exists = await fileExists(filePath)
      return exists ? config.value : null
    })
  )
  return results.filter((id): id is string => id !== null)
}

/**
 * 获取需要监听的项目级目录列表
 * 只监听包含工具配置的一级隐藏目录
 */
function getProjectWatchDirs(projectDir: string): string[] {
  const dirs = new Set<string>()
  for (const config of AI_TOOLS) {
    if (config.scope === 'project' && config.detectionPath) {
      // 获取第一级目录（如 .claude, .cursor 等）
      const path = config.detectionPath as string
      const firstDir = path.split('/')[0]
      if (firstDir) {
        dirs.add(join(projectDir, firstDir))
      }
    }
  }
  return Array.from(dirs)
}

/**
 * 获取需要监听的全局目录列表
 * 如 Codex 的 ~/.codex/prompts/
 */
function getGlobalWatchDirs(): string[] {
  const dirs = new Set<string>()
  for (const config of AI_TOOLS) {
    if (config.scope === 'global' && config.detectionPath) {
      const filePath = (config.detectionPath as () => string)()
      // 监听文件所在的目录
      dirs.add(dirname(filePath))
    }
  }
  return Array.from(dirs)
}

/**
 * 检测项目中已配置的工具（响应式）
 *
 * 监听两类目录：
 * 1. 项目级配置目录（如 .claude, .cursor 等）
 * 2. 全局配置目录（如 ~/.codex/prompts/）
 *
 * @param projectDir 项目根目录
 * @returns 已配置的工具 ID 列表
 */
export async function getConfiguredTools(projectDir: string): Promise<string[]> {
  const normalizedPath = resolve(projectDir)
  const key = `tools:${normalizedPath}`

  let state = stateCache.get(key)

  if (!state) {
    // 初始扫描
    const initialValue = await scanConfiguredTools(normalizedPath)

    // 创建响应式状态
    state = new ReactiveState<string[]>(initialValue, {
      // 数组相等性比较
      equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    })
    stateCache.set(key, state)

    const releases: (() => void)[] = []
    const onUpdate = async () => {
      const newValue = await scanConfiguredTools(normalizedPath)
      state!.set(newValue)
    }

    // 1. 监听项目级配置目录（如 .claude, .cursor 等）
    const projectWatchDirs = getProjectWatchDirs(normalizedPath)
    for (const dir of projectWatchDirs) {
      const release = acquireWatcher(dir, onUpdate, { recursive: true })
      releases.push(release)
    }

    // 2. 监听全局配置目录（如 ~/.codex/prompts/）
    const globalWatchDirs = getGlobalWatchDirs()
    for (const dir of globalWatchDirs) {
      const release = acquireWatcher(dir, onUpdate, { recursive: false })
      releases.push(release)
    }

    // 3. 监听项目根目录（非递归），以捕获新创建的配置目录
    const rootRelease = acquireWatcher(normalizedPath, onUpdate, { recursive: false })
    releases.push(rootRelease)

    releaseCache.set(key, () => releases.forEach((r) => r()))
  }

  return state.get()
}

/**
 * 检查特定工具是否已配置
 *
 * @param projectDir 项目根目录
 * @param toolId 工具 ID
 * @returns 是否已配置
 */
export async function isToolConfigured(projectDir: string, toolId: string): Promise<boolean> {
  const configured = await getConfiguredTools(projectDir)
  return configured.includes(toolId)
}
