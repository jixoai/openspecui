/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Preserve the complete pinned OpenSpec 1.9 Agent delivery registry in one typed physical owner.
 * 2. Co-locate capability, command artifact, invocation, alias, setup, cleanup, and migration metadata.
 * 3. Model current/legacy project roots, user-global skill roots, detection paths, and IDE restart facts.
 * 4. Provide deterministic path-template helpers without reading runtime filesystem state.
 * 5. Select the official inventory per admitted CLI line (1.8 lacks Command Code and restart facts).
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */

export type AgentCommandSurfaceCapability = 'adapter-backed' | 'skills-invocable' | 'none'
export type AgentCommandFormat = 'markdown' | 'toml'
export type AgentCommandInvocationStyle = 'flat' | 'namespaced'

export type AgentCommandContentFormat =
  | {
      kind: 'markdown'
      frontmatter: { kind: 'yaml'; fields: readonly string[] } | { kind: 'none' }
      bodyLayout: 'direct' | 'headings'
    }
  | {
      kind: 'toml'
      fields: readonly ['description', 'prompt']
    }

export interface AgentCommandArtifact {
  scope: 'project'
  format: AgentCommandFormat
  content: AgentCommandContentFormat
  pathTemplate: string
  legacyPathTemplates?: readonly string[]
  invocation: {
    style: AgentCommandInvocationStyle
    prefix: '@' | '/'
  }
}

export interface AgentProjectCleanup {
  kind: 'project-patterns'
  patterns: readonly string[]
}

export interface AgentManagedGlobalPromptCleanup {
  kind: 'managed-global-prompts'
  projectPatterns: readonly string[]
  managedFiles: Readonly<Record<string, readonly string[]>>
  replacementLabel: string
}

export type AgentDeliveryCleanup = AgentProjectCleanup | AgentManagedGlobalPromptCleanup

export interface AgentDeliveryMigration {
  from: string
  to: string
  needsConsent: boolean
}

export interface AIToolOption {
  name: string
  value: string
  available: boolean
  successLabel?: string
  /** Current project-local skills root; null when delivery targets the user-global root only. */
  skillsDir: string | null
  /** Former project roots read for detection and migrated after replacement. */
  legacySkillsDirs?: readonly string[]
  /** User-global skills root resolved against the home directory (e.g. `.minimax`). */
  globalSkillsDir?: string | null
  detectionPaths?: readonly string[]
  setupNote?: string
  /** True when the tool loads generated files through an IDE/editor process that must restart. */
  requiresIdeRestart?: boolean
  /** First official CLI line declaring `requiresIdeRestart`; earlier lines carry no restart fact. */
  requiresIdeRestartSince?: AgentCliSeries
  /** First official CLI line shipping this tool; earlier lines never list it. */
  minCliSeries?: AgentCliSeries
  capability: AgentCommandSurfaceCapability
  command: AgentCommandArtifact | null
  aliases?: readonly string[]
  cleanup?: AgentDeliveryCleanup
  migrations?: readonly AgentDeliveryMigration[]
}

/** Official OpenSpec CLI lines with distinct Agent inventories. */
export type AgentCliSeries = '1.8' | '1.9'

function agentCliSeriesOrder(series: AgentCliSeries): number {
  return series === '1.9' ? 19 : 18
}

/**
 * Select the official Agent delivery inventory for one CLI version string.
 *
 * Only a stable, admitted version — current (1.9.x) or supported non-current (1.8.x) — selects
 * an inventory. Unsupported forms (prereleases, >=1.10, below-range) and unparseable output
 * select none: a page-level version bypass must not manufacture a 1.9 inventory for a CLI the
 * release line refuses to admit.
 */
export function selectAgentDeliveryRegistry(cliVersion: string | null): ToolConfig[] {
  const series = parseOpenSpecCliSeries(cliVersion)
  if (series === null) {
    return []
  }
  const running = agentCliSeriesOrder(series)
  return AGENT_DELIVERY_REGISTRY.filter((tool) => {
    if (tool.minCliSeries && agentCliSeriesOrder(tool.minCliSeries) > running) return false
    return true
  }).map((tool) => {
    if (
      tool.requiresIdeRestart !== undefined &&
      tool.requiresIdeRestartSince &&
      agentCliSeriesOrder(tool.requiresIdeRestartSince) > running
    ) {
      const { ...rest } = tool
      delete rest.requiresIdeRestart
      return rest
    }
    return { ...tool }
  })
}

/**
 * Parse a CLI version string into an admitted Agent inventory line.
 *
 * Returns '1.9' only for stable 1.9.x, '1.8' only for stable 1.8.x, and null for every
 * non-admitted form: prereleases, >=1.10, below-range, or unparseable output.
 */
export function parseOpenSpecCliSeries(cliVersion: string | null): AgentCliSeries | null {
  if (!cliVersion) return null
  const match = /^(\d+)\.(\d+)(?:\.(\d+))?(-\S+)?$/.exec(cliVersion.trim())
  if (!match || match[4]) return null
  const major = Number(match[1])
  const minor = Number(match[2])
  if (major === 1 && minor === 9) return '1.9'
  if (major === 1 && minor === 8) return '1.8'
  return null
}

export interface ToolConfig extends AIToolOption {}

const CODEX_MANAGED_PROMPTS = {
  'opsx-propose.md': ['propose'],
  'opsx-explore.md': ['explore'],
  'opsx-new.md': ['new'],
  'opsx-continue.md': ['continue'],
  'opsx-apply.md': ['apply'],
  'opsx-update.md': ['update'],
  'opsx-ff.md': ['ff'],
  'opsx-sync.md': ['sync'],
  'opsx-archive.md': ['archive'],
  'opsx-bulk-archive.md': ['bulk-archive'],
  'opsx-verify.md': ['verify'],
  'opsx-onboard.md': ['onboard'],
} as const satisfies Readonly<Record<string, readonly string[]>>

function command(
  pathTemplate: string,
  content: AgentCommandContentFormat,
  options: {
    invocationPrefix?: '@' | '/'
    legacyPathTemplates?: readonly string[]
  } = {}
): AgentCommandArtifact {
  const fileName = pathTemplate.split('/').at(-1) ?? pathTemplate
  return {
    scope: 'project',
    format: content.kind,
    content,
    pathTemplate,
    legacyPathTemplates: options.legacyPathTemplates,
    invocation: {
      style: fileName.startsWith('opsx-') ? 'flat' : 'namespaced',
      prefix: options.invocationPrefix ?? '/',
    },
  }
}

const yamlMarkdown = (...fields: string[]): AgentCommandContentFormat => ({
  kind: 'markdown',
  frontmatter: { kind: 'yaml', fields },
  bodyLayout: 'direct',
})

const headingMarkdown: AgentCommandContentFormat = {
  kind: 'markdown',
  frontmatter: { kind: 'none' },
  bodyLayout: 'headings',
}

const plainMarkdown: AgentCommandContentFormat = {
  kind: 'markdown',
  frontmatter: { kind: 'none' },
  bodyLayout: 'direct',
}

const tomlCommand: AgentCommandContentFormat = {
  kind: 'toml',
  fields: ['description', 'prompt'],
}

const projectCleanup = (...patterns: string[]): AgentProjectCleanup => ({
  kind: 'project-patterns',
  patterns,
})

/** Complete OpenSpec 1.9 Agent delivery registry in official order. */
export const AGENT_DELIVERY_REGISTRY: ToolConfig[] = [
  {
    name: 'Amazon Q Developer',
    value: 'amazon-q',
    available: true,
    successLabel: 'Amazon Q Developer',
    skillsDir: '.amazonq',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.amazonq/prompts/opsx-{workflow}.md', yamlMarkdown('description'), {
      invocationPrefix: '@',
    }),
    cleanup: projectCleanup('.amazonq/prompts/openspec-*.md'),
  },
  {
    name: 'Antigravity',
    value: 'antigravity',
    available: true,
    successLabel: 'Antigravity',
    skillsDir: '.agent',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.agent/workflows/opsx-{workflow}.md', yamlMarkdown('description')),
    cleanup: projectCleanup('.agent/workflows/openspec-*.md'),
  },
  {
    name: 'Auggie (Augment CLI)',
    value: 'auggie',
    available: true,
    successLabel: 'Auggie',
    skillsDir: '.augment',
    capability: 'adapter-backed',
    command: command(
      '.augment/commands/opsx-{workflow}.md',
      yamlMarkdown('description', 'argument-hint')
    ),
    cleanup: projectCleanup('.augment/commands/openspec-*.md'),
  },
  {
    name: 'Bob Shell',
    value: 'bob',
    available: true,
    successLabel: 'Bob Shell',
    skillsDir: '.bob',
    capability: 'adapter-backed',
    command: command(
      '.bob/commands/opsx-{workflow}.md',
      yamlMarkdown('description', 'argument-hint')
    ),
  },
  {
    name: 'Claude Code',
    value: 'claude',
    available: true,
    successLabel: 'Claude Code',
    skillsDir: '.claude',
    capability: 'adapter-backed',
    command: command(
      '.claude/commands/opsx/{workflow}.md',
      yamlMarkdown('name', 'description', 'allowed-tools', 'category', 'tags')
    ),
    cleanup: projectCleanup('.claude/commands/openspec'),
  },
  {
    name: 'Cline',
    value: 'cline',
    available: true,
    successLabel: 'Cline',
    skillsDir: '.cline',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.clinerules/workflows/opsx-{workflow}.md', headingMarkdown),
    cleanup: projectCleanup('.clinerules/workflows/openspec-*.md'),
  },
  {
    name: 'Command Code',
    value: 'command-code',
    minCliSeries: '1.9',
    available: true,
    successLabel: 'Command Code',
    skillsDir: '.commandcode',
    capability: 'adapter-backed',
    // Command Code executes the trimmed markdown body and substitutes arguments
    // where the body carries an argument placeholder (see the upstream adapter).
    command: command('.commandcode/commands/opsx-{workflow}.md', plainMarkdown),
  },
  {
    name: 'CodeArts',
    value: 'codeartsagent',
    available: true,
    successLabel: 'CodeArts',
    skillsDir: '.codeartsdoer',
    capability: 'none',
    command: null,
  },
  {
    name: 'Codex',
    value: 'codex',
    available: true,
    successLabel: 'Codex',
    skillsDir: '.agents',
    legacySkillsDirs: ['.codex'],
    detectionPaths: ['.agents/skills', '.codex/skills'],
    capability: 'skills-invocable',
    command: null,
    cleanup: {
      kind: 'managed-global-prompts',
      projectPatterns: ['.codex/prompts/openspec-*.md'],
      managedFiles: CODEX_MANAGED_PROMPTS,
      replacementLabel: 'Codex skills',
    },
    migrations: [{ from: '.codex', to: '.agents', needsConsent: false }],
  },
  {
    name: 'Devin Desktop (formerly Windsurf)',
    value: 'devin',
    available: true,
    successLabel: 'Devin Desktop',
    skillsDir: '.devin',
    detectionPaths: ['.devin', '.windsurf'],
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command(
      '.devin/workflows/opsx-{workflow}.md',
      yamlMarkdown('name', 'description', 'category', 'tags')
    ),
    aliases: ['windsurf'],
    cleanup: projectCleanup('.windsurf/workflows/openspec-*.md'),
    migrations: [{ from: '.windsurf', to: '.devin', needsConsent: true }],
  },
  {
    name: 'ForgeCode',
    value: 'forgecode',
    available: true,
    successLabel: 'ForgeCode',
    skillsDir: '.forge',
    capability: 'none',
    command: null,
  },
  {
    name: 'CodeBuddy Code (CLI)',
    value: 'codebuddy',
    available: true,
    successLabel: 'CodeBuddy Code',
    skillsDir: '.codebuddy',
    capability: 'adapter-backed',
    command: command(
      '.codebuddy/commands/opsx/{workflow}.md',
      yamlMarkdown('name', 'description', 'argument-hint')
    ),
    cleanup: projectCleanup('.codebuddy/commands/openspec'),
  },
  {
    name: 'Continue',
    value: 'continue',
    available: true,
    successLabel: 'Continue (VS Code / JetBrains / Cli)',
    skillsDir: '.continue',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command(
      '.continue/prompts/opsx-{workflow}.prompt',
      yamlMarkdown('name', 'description', 'invokable')
    ),
    cleanup: projectCleanup('.continue/prompts/openspec-*.prompt'),
  },
  {
    name: 'CoStrict',
    value: 'costrict',
    available: true,
    successLabel: 'CoStrict',
    skillsDir: '.cospec',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command(
      '.cospec/openspec/commands/opsx-{workflow}.md',
      yamlMarkdown('description', 'argument-hint')
    ),
    cleanup: projectCleanup('.cospec/openspec/commands'),
  },
  {
    name: 'Crush',
    value: 'crush',
    available: true,
    successLabel: 'Crush',
    skillsDir: '.crush',
    capability: 'adapter-backed',
    command: command(
      '.crush/commands/opsx/{workflow}.md',
      yamlMarkdown('name', 'description', 'category', 'tags')
    ),
    cleanup: projectCleanup('.crush/commands/openspec'),
  },
  {
    name: 'Cursor',
    value: 'cursor',
    available: true,
    successLabel: 'Cursor',
    skillsDir: '.cursor',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command(
      '.cursor/commands/opsx-{workflow}.md',
      yamlMarkdown('name', 'id', 'category', 'description')
    ),
    cleanup: projectCleanup('.cursor/commands/openspec-*.md'),
  },
  {
    name: 'Factory Droid',
    value: 'factory',
    available: true,
    successLabel: 'Factory Droid',
    skillsDir: '.factory',
    capability: 'adapter-backed',
    command: command(
      '.factory/commands/opsx-{workflow}.md',
      yamlMarkdown('description', 'argument-hint')
    ),
    cleanup: projectCleanup('.factory/commands/openspec-*.md'),
  },
  {
    name: 'Gemini CLI',
    value: 'gemini',
    available: true,
    successLabel: 'Gemini CLI',
    skillsDir: '.gemini',
    capability: 'adapter-backed',
    command: command('.gemini/commands/opsx/{workflow}.toml', tomlCommand),
    cleanup: projectCleanup('.gemini/commands/openspec'),
  },
  {
    name: 'GitHub Copilot',
    value: 'github-copilot',
    available: true,
    successLabel: 'GitHub Copilot',
    skillsDir: '.github',
    detectionPaths: [
      '.github/copilot-instructions.md',
      '.github/instructions',
      '.github/workflows/copilot-setup-steps.yml',
      '.github/prompts',
      '.github/agents',
      '.github/skills',
      '.github/.mcp.json',
    ],
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.github/prompts/opsx-{workflow}.prompt.md', yamlMarkdown('description')),
    cleanup: projectCleanup('.github/prompts/openspec-*.prompt.md'),
  },
  {
    name: 'Hermes Agent',
    value: 'hermes',
    available: true,
    successLabel: 'Hermes Agent',
    skillsDir: '.hermes',
    detectionPaths: ['.hermes', 'HERMES.md', '.hermes.md'],
    setupNote:
      "Hermes only loads skills from ~/.hermes/skills by default. Add this project's .hermes/skills directory to skills.external_dirs in ~/.hermes/config.yaml so Hermes picks up the generated OpenSpec skills.",
    capability: 'none',
    command: null,
  },
  {
    name: 'iFlow',
    value: 'iflow',
    available: true,
    successLabel: 'iFlow',
    skillsDir: '.iflow',
    capability: 'adapter-backed',
    command: command(
      '.iflow/commands/opsx-{workflow}.md',
      yamlMarkdown('name', 'id', 'category', 'description')
    ),
    cleanup: projectCleanup('.iflow/commands/openspec-*.md'),
  },
  {
    name: 'Junie',
    value: 'junie',
    available: true,
    successLabel: 'Junie',
    skillsDir: '.junie',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.junie/commands/opsx-{workflow}.md', yamlMarkdown('description')),
    cleanup: projectCleanup('.junie/commands/opsx-*.md', '.junie/commands/openspec-*.md'),
  },
  {
    name: 'Kilo Code',
    value: 'kilocode',
    available: true,
    successLabel: 'Kilo Code',
    skillsDir: '.kilocode',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.kilocode/workflows/opsx-{workflow}.md', plainMarkdown),
    cleanup: projectCleanup('.kilocode/workflows/openspec-*.md'),
  },
  {
    name: 'Kimi Code',
    value: 'kimi',
    available: true,
    successLabel: 'Kimi Code',
    skillsDir: '.kimi-code',
    detectionPaths: ['.kimi-code', '.kimi'],
    capability: 'none',
    command: null,
    migrations: [{ from: '.kimi', to: '.kimi-code', needsConsent: false }],
  },
  {
    name: 'Kiro',
    value: 'kiro',
    available: true,
    successLabel: 'Kiro',
    skillsDir: '.kiro',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.kiro/prompts/opsx-{workflow}.prompt.md', yamlMarkdown('description')),
    cleanup: projectCleanup('.kiro/prompts/openspec-*.prompt.md'),
  },
  {
    name: 'Lingma',
    value: 'lingma',
    available: true,
    successLabel: 'Lingma',
    skillsDir: '.lingma',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command(
      '.lingma/commands/opsx/{workflow}.md',
      yamlMarkdown('name', 'description', 'category', 'tags')
    ),
    cleanup: projectCleanup('.lingma/commands/openspec'),
  },
  {
    name: 'MiniMax Code',
    value: 'minimax-code',
    available: true,
    successLabel: 'MiniMax Code',
    skillsDir: null,
    globalSkillsDir: '.minimax',
    capability: 'skills-invocable',
    command: null,
  },
  {
    name: 'Mistral Vibe',
    value: 'vibe',
    available: true,
    successLabel: 'Mistral Vibe',
    skillsDir: '.vibe',
    capability: 'none',
    command: null,
  },
  {
    name: 'Oh My Pi',
    value: 'oh-my-pi',
    available: true,
    successLabel: 'Oh My Pi',
    skillsDir: '.omp',
    capability: 'adapter-backed',
    command: command('.omp/commands/opsx-{workflow}.md', yamlMarkdown('description')),
  },
  {
    name: 'OpenCode',
    value: 'opencode',
    available: true,
    successLabel: 'OpenCode',
    skillsDir: '.opencode',
    capability: 'adapter-backed',
    command: command('.opencode/commands/opsx-{workflow}.md', yamlMarkdown('description'), {
      legacyPathTemplates: ['.opencode/command/opsx-{workflow}.md'],
    }),
    cleanup: projectCleanup('.opencode/command/opsx-*.md', '.opencode/command/openspec-*.md'),
  },
  {
    name: 'Pi',
    value: 'pi',
    available: true,
    successLabel: 'Pi',
    skillsDir: '.pi',
    capability: 'adapter-backed',
    command: command('.pi/prompts/opsx-{workflow}.md', yamlMarkdown('description')),
  },
  {
    name: 'Qoder',
    value: 'qoder',
    available: true,
    successLabel: 'Qoder',
    skillsDir: '.qoder',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command(
      '.qoder/commands/opsx/{workflow}.md',
      yamlMarkdown('name', 'description', 'category', 'tags')
    ),
    cleanup: projectCleanup('.qoder/commands/openspec'),
  },
  {
    name: 'Qwen Code',
    value: 'qwen',
    available: true,
    successLabel: 'Qwen Code',
    skillsDir: '.qwen',
    capability: 'adapter-backed',
    command: command('.qwen/commands/opsx-{workflow}.md', yamlMarkdown('description')),
    cleanup: projectCleanup('.qwen/commands/opsx-*.toml', '.qwen/commands/openspec-*.toml'),
  },
  {
    name: 'Rovo Dev CLI',
    value: 'rovodev',
    available: true,
    successLabel: 'Rovo Dev CLI',
    skillsDir: '.rovodev',
    detectionPaths: ['.rovodev/skills', '.rovodev'],
    capability: 'skills-invocable',
    command: null,
  },
  {
    name: 'Zoo Code',
    value: 'roocode',
    available: true,
    successLabel: 'Zoo Code',
    skillsDir: '.roo',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.roo/commands/opsx-{workflow}.md', headingMarkdown),
    cleanup: projectCleanup('.roo/commands/openspec-*.md'),
  },
  {
    name: 'Trae',
    value: 'trae',
    available: true,
    successLabel: 'Trae',
    skillsDir: '.trae',
    requiresIdeRestart: true,
    requiresIdeRestartSince: '1.9',
    capability: 'adapter-backed',
    command: command('.trae/commands/opsx-{workflow}.md', yamlMarkdown('name', 'description')),
  },
  {
    name: 'ZCode',
    value: 'zcode',
    available: true,
    successLabel: 'ZCode',
    skillsDir: '.zcode',
    capability: 'adapter-backed',
    command: command(
      '.zcode/commands/opsx/{workflow}.md',
      yamlMarkdown('name', 'description', 'category', 'tags')
    ),
  },
  {
    // Vendor-neutral target for assistants that read the shared `.agents` root.
    // Detection keys off `.agents/skills` rather than the bare root because
    // frameworks use `.agents/` for more than skills.
    name: 'Shared .agents skills',
    value: 'agents',
    available: true,
    successLabel: 'shared .agents skills',
    skillsDir: '.agents',
    detectionPaths: ['.agents/skills'],
    capability: 'skills-invocable',
    command: null,
  },
]

/** Backwards-compatible public name; the registry remains the single physical owner. */
export const AI_TOOLS = AGENT_DELIVERY_REGISTRY

/** Resolve retired ids to their current official registry entry id. */
export function resolveAgentToolId(toolId: string): string {
  const aliased = AGENT_DELIVERY_REGISTRY.find((tool) => tool.aliases?.includes(toolId))
  return aliased?.value ?? toolId
}

/** Resolve one command path template for an OPSX workflow. */
export function resolveAgentCommandPathTemplate(pathTemplate: string, workflow: string): string {
  return pathTemplate.replace('{workflow}', workflow)
}
