/**
 * 工具配置检测模块
 *
 * 基于 @fission-ai/openspec 的 configurators 实现
 * 用于检测项目中已配置的 AI 工具
 *
 * 重要：使用响应式文件系统实现，监听项目根目录（递归），
 * 当配置文件变化时会自动触发更新。
 *
 * @see references/openspec/src/core/configurators/slash/
 */

import { stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { ReactiveState, acquireWatcher } from './reactive-fs/index.js'

/**
 * 工具配置信息
 */
export interface ToolConfig {
  /** 工具 ID */
  toolId: string
  /** 检测路径（相对于项目根目录） */
  detectionPath: string
}

/**
 * 所有支持的工具配置
 *
 * 检测路径使用 proposal 命令文件，因为这是 openspec init 创建的第一个文件
 * 如果该文件存在，说明工具已配置
 */
export const TOOL_CONFIGS: ToolConfig[] = [
  // Claude Code - .claude/commands/openspec/proposal.md
  { toolId: 'claude', detectionPath: '.claude/commands/openspec/proposal.md' },

  // Cursor - .cursor/commands/openspec-proposal.md
  { toolId: 'cursor', detectionPath: '.cursor/commands/openspec-proposal.md' },

  // Windsurf - .windsurf/workflows/openspec-proposal.md
  { toolId: 'windsurf', detectionPath: '.windsurf/workflows/openspec-proposal.md' },

  // Cline - .clinerules/workflows/openspec-proposal.md
  { toolId: 'cline', detectionPath: '.clinerules/workflows/openspec-proposal.md' },

  // GitHub Copilot - .github/prompts/openspec-proposal.prompt.md
  { toolId: 'github-copilot', detectionPath: '.github/prompts/openspec-proposal.prompt.md' },

  // Amazon Q - .amazonq/prompts/openspec-proposal.md
  { toolId: 'amazon-q', detectionPath: '.amazonq/prompts/openspec-proposal.md' },

  // Codex - .codex/prompts/openspec-proposal.md (注意：Codex 使用全局目录，这里检测项目目录)
  { toolId: 'codex', detectionPath: '.codex/prompts/openspec-proposal.md' },

  // Gemini - .gemini/commands/openspec/proposal.toml
  { toolId: 'gemini', detectionPath: '.gemini/commands/openspec/proposal.toml' },

  // Auggie - .augment/commands/openspec-proposal.md
  { toolId: 'auggie', detectionPath: '.augment/commands/openspec-proposal.md' },

  // CodeBuddy - .codebuddy/commands/openspec/proposal.md
  { toolId: 'codebuddy', detectionPath: '.codebuddy/commands/openspec/proposal.md' },

  // Qoder - .qoder/commands/openspec/proposal.md
  { toolId: 'qoder', detectionPath: '.qoder/commands/openspec/proposal.md' },

  // RooCode - .roo/commands/openspec-proposal.md
  { toolId: 'roocode', detectionPath: '.roo/commands/openspec-proposal.md' },

  // KiloCode - .kilocode/workflows/openspec-proposal.md
  { toolId: 'kilocode', detectionPath: '.kilocode/workflows/openspec-proposal.md' },

  // OpenCode - .opencode/command/openspec-proposal.md
  { toolId: 'opencode', detectionPath: '.opencode/command/openspec-proposal.md' },

  // Factory - .factory/commands/openspec-proposal.md
  { toolId: 'factory', detectionPath: '.factory/commands/openspec-proposal.md' },

  // Crush - .crush/commands/openspec/proposal.md
  { toolId: 'crush', detectionPath: '.crush/commands/openspec/proposal.md' },

  // Costrict - .cospec/openspec/commands/openspec-proposal.md
  { toolId: 'costrict', detectionPath: '.cospec/openspec/commands/openspec-proposal.md' },

  // Qwen - .qwen/commands/openspec-proposal.toml
  { toolId: 'qwen', detectionPath: '.qwen/commands/openspec-proposal.toml' },

  // iFlow - .iflow/commands/openspec-proposal.md
  { toolId: 'iflow', detectionPath: '.iflow/commands/openspec-proposal.md' },

  // Antigravity - .agent/workflows/openspec-proposal.md
  { toolId: 'antigravity', detectionPath: '.agent/workflows/openspec-proposal.md' },
]

/**
 * 获取所有可用的工具 ID 列表
 */
export function getAvailableToolIds(): string[] {
  return TOOL_CONFIGS.map((config) => config.toolId)
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
 * 扫描已配置的工具（并行检查）
 */
async function scanConfiguredTools(projectDir: string): Promise<string[]> {
  // 并行检查所有工具配置文件
  const results = await Promise.all(
    TOOL_CONFIGS.map(async (config) => {
      const filePath = join(projectDir, config.detectionPath)
      const exists = await fileExists(filePath)
      return exists ? config.toolId : null
    })
  )
  return results.filter((id): id is string => id !== null)
}

/**
 * 获取需要监听的目录列表
 * 只监听包含工具配置的一级隐藏目录
 */
function getWatchDirs(projectDir: string): string[] {
  const dirs = new Set<string>()
  for (const config of TOOL_CONFIGS) {
    // 获取第一级目录（如 .claude, .cursor 等）
    const firstDir = config.detectionPath.split('/')[0]
    if (firstDir) {
      dirs.add(join(projectDir, firstDir))
    }
  }
  return Array.from(dirs)
}

/**
 * 检测项目中已配置的工具（响应式）
 *
 * 只监听包含工具配置的隐藏目录（如 .claude, .cursor 等），
 * 避免递归监听整个项目导致的性能问题。
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

    // 只监听工具配置目录（如 .claude, .cursor 等），而不是整个项目
    const watchDirs = getWatchDirs(normalizedPath)
    const releases: (() => void)[] = []

    for (const dir of watchDirs) {
      const release = acquireWatcher(
        dir,
        async () => {
          const newValue = await scanConfiguredTools(normalizedPath)
          state!.set(newValue)
        },
        { recursive: true }
      )
      releases.push(release)
    }

    // 也监听项目根目录（非递归），以捕获新创建的配置目录
    const rootRelease = acquireWatcher(
      normalizedPath,
      async () => {
        const newValue = await scanConfiguredTools(normalizedPath)
        state!.set(newValue)
      },
      { recursive: false }
    )
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
