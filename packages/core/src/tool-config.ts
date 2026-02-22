/**
 * 工具配置检测模块
 *
 * 对齐 @fission-ai/openspec 的 skills 体系，
 * 通过 `skills/<skill>/SKILL.md` 判断工具是否已配置。
 */

import { join, resolve } from 'node:path'
import { ReactiveState, acquireWatcher, reactiveExists } from './reactive-fs/index.js'

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
  /** 技能目录（相对项目根目录） */
  skillsDir?: string
}

/**
 * 完整的工具配置（元信息 + skills 目录）
 */
export interface ToolConfig extends AIToolOption {}

/**
 * OpenSpec 初始化生成的技能目录名称
 * @see references/openspec/src/core/shared/tool-detection.ts
 */
export const SKILL_NAMES = [
  'openspec-explore',
  'openspec-new-change',
  'openspec-continue-change',
  'openspec-apply-change',
  'openspec-ff-change',
  'openspec-sync-specs',
  'openspec-archive-change',
  'openspec-bulk-archive-change',
  'openspec-verify-change',
] as const

/**
 * 所有支持的 AI 工具配置
 * 完全对齐官方 OpenSpec CLI 的 AI_TOOLS
 */
export const AI_TOOLS: ToolConfig[] = [
  {
    name: 'Amazon Q Developer',
    value: 'amazon-q',
    available: true,
    successLabel: 'Amazon Q Developer',
    skillsDir: '.amazonq',
  },
  {
    name: 'Antigravity',
    value: 'antigravity',
    available: true,
    successLabel: 'Antigravity',
    skillsDir: '.agent',
  },
  {
    name: 'Auggie (Augment CLI)',
    value: 'auggie',
    available: true,
    successLabel: 'Auggie',
    skillsDir: '.augment',
  },
  {
    name: 'Claude Code',
    value: 'claude',
    available: true,
    successLabel: 'Claude Code',
    skillsDir: '.claude',
  },
  { name: 'Cline', value: 'cline', available: true, successLabel: 'Cline', skillsDir: '.cline' },
  { name: 'Codex', value: 'codex', available: true, successLabel: 'Codex', skillsDir: '.codex' },
  {
    name: 'CodeBuddy Code (CLI)',
    value: 'codebuddy',
    available: true,
    successLabel: 'CodeBuddy Code',
    skillsDir: '.codebuddy',
  },
  {
    name: 'Continue',
    value: 'continue',
    available: true,
    successLabel: 'Continue (VS Code / JetBrains / Cli)',
    skillsDir: '.continue',
  },
  {
    name: 'CoStrict',
    value: 'costrict',
    available: true,
    successLabel: 'CoStrict',
    skillsDir: '.cospec',
  },
  { name: 'Crush', value: 'crush', available: true, successLabel: 'Crush', skillsDir: '.crush' },
  {
    name: 'Cursor',
    value: 'cursor',
    available: true,
    successLabel: 'Cursor',
    skillsDir: '.cursor',
  },
  {
    name: 'Factory Droid',
    value: 'factory',
    available: true,
    successLabel: 'Factory Droid',
    skillsDir: '.factory',
  },
  {
    name: 'Gemini CLI',
    value: 'gemini',
    available: true,
    successLabel: 'Gemini CLI',
    skillsDir: '.gemini',
  },
  {
    name: 'GitHub Copilot',
    value: 'github-copilot',
    available: true,
    successLabel: 'GitHub Copilot',
    skillsDir: '.github',
  },
  { name: 'iFlow', value: 'iflow', available: true, successLabel: 'iFlow', skillsDir: '.iflow' },
  {
    name: 'Kilo Code',
    value: 'kilocode',
    available: true,
    successLabel: 'Kilo Code',
    skillsDir: '.kilocode',
  },
  {
    name: 'OpenCode',
    value: 'opencode',
    available: true,
    successLabel: 'OpenCode',
    skillsDir: '.opencode',
  },
  { name: 'Qoder', value: 'qoder', available: true, successLabel: 'Qoder', skillsDir: '.qoder' },
  {
    name: 'Qwen Code',
    value: 'qwen',
    available: true,
    successLabel: 'Qwen Code',
    skillsDir: '.qwen',
  },
  {
    name: 'RooCode',
    value: 'roocode',
    available: true,
    successLabel: 'RooCode',
    skillsDir: '.roo',
  },
  { name: 'Trae', value: 'trae', available: true, successLabel: 'Trae', skillsDir: '.trae' },
  {
    name: 'Windsurf',
    value: 'windsurf',
    available: true,
    successLabel: 'Windsurf',
    skillsDir: '.windsurf',
  },
  {
    name: 'AGENTS.md (works with Amp, VS Code, …)',
    value: 'agents',
    available: false,
    successLabel: 'your AGENTS.md-compatible assistant',
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

function getSkillsDir(projectDir: string, tool: ToolConfig): string | null {
  if (!tool.skillsDir) return null
  return join(projectDir, tool.skillsDir, 'skills')
}

async function getSkillCount(projectDir: string, tool: ToolConfig): Promise<number> {
  const skillsDir = getSkillsDir(projectDir, tool)
  if (!skillsDir) return 0

  let count = 0
  for (const skillName of SKILL_NAMES) {
    const skillFile = join(skillsDir, skillName, 'SKILL.md')
    if (await reactiveExists(skillFile)) {
      count++
    }
  }
  return count
}

/**
 * 扫描已配置的工具（并行检查）
 */
async function scanConfiguredTools(projectDir: string): Promise<string[]> {
  const results = await Promise.all(
    AI_TOOLS.map(async (config) => {
      if (!config.skillsDir) return null
      const count = await getSkillCount(projectDir, config)
      return count > 0 ? config.value : null
    })
  )
  return results.filter((id): id is string => id !== null)
}

/**
 * 获取需要监听的项目级目录列表
 */
function getProjectWatchDirs(projectDir: string): string[] {
  const dirs = new Set<string>()
  for (const config of AI_TOOLS) {
    if (!config.skillsDir) continue
    dirs.add(join(projectDir, config.skillsDir))
  }
  return Array.from(dirs)
}

/**
 * 检测项目中已配置的工具（响应式）
 */
export async function getConfiguredTools(projectDir: string): Promise<string[]> {
  const normalizedPath = resolve(projectDir)
  const key = `tools:${normalizedPath}`

  let state = stateCache.get(key)

  if (!state) {
    const initialValue = await scanConfiguredTools(normalizedPath)

    state = new ReactiveState<string[]>(initialValue, {
      equals: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]),
    })
    stateCache.set(key, state)

    const releases: (() => void)[] = []
    const onUpdate = async () => {
      const newValue = await scanConfiguredTools(normalizedPath)
      state!.set(newValue)
    }

    const projectWatchDirs = getProjectWatchDirs(normalizedPath)
    for (const dir of projectWatchDirs) {
      const release = acquireWatcher(dir, onUpdate, { recursive: true })
      releases.push(release)
    }

    const rootRelease = acquireWatcher(normalizedPath, onUpdate, { recursive: false })
    releases.push(rootRelease)

    releaseCache.set(key, () => releases.forEach((r) => r()))
  }

  return state.get()
}

/**
 * 检查特定工具是否已配置
 */
export async function isToolConfigured(projectDir: string, toolId: string): Promise<boolean> {
  const configured = await getConfiguredTools(projectDir)
  return configured.includes(toolId)
}
