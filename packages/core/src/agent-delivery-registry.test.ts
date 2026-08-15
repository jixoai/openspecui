/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Lock the complete pinned OpenSpec 1.9 Agent delivery registry at the public Core boundary.
 * 2. Prove capability, command format/invocation, alias, detection, setup, cleanup, migration,
 *    global skill roots, legacy roots, and IDE restart facts stay co-located.
 * 3. Provide explicit mutation-resistance evidence for every load-bearing registry dimension.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Review correction (2026-08-02): checked mutation fixtures must not bypass fabricated-state nullability.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */

import { describe, expect, it } from 'vitest'
import { selectAgentDeliveryRegistry } from './agent-delivery-registry.js'
import { AI_TOOLS, type ToolConfig } from './tool-config.js'

type ExpectedTool = readonly [
  id: string,
  label: string,
  skillsDir: string | null,
  capability: ToolConfig['capability'],
  commandPath: string | null,
  commandFormat: ToolConfig['command'] extends infer Command
    ? Command extends { format: infer Format }
      ? Format | null
      : null
    : null,
  invocationStyle: 'flat' | 'namespaced' | null,
  invocationPrefix: '@' | '/' | null,
]

const OFFICIAL_REGISTRY = [
  [
    'amazon-q',
    'Amazon Q Developer',
    '.amazonq',
    'adapter-backed',
    '.amazonq/prompts/opsx-{workflow}.md',
    'markdown',
    'flat',
    '@',
  ],
  [
    'antigravity',
    'Antigravity',
    '.agent',
    'adapter-backed',
    '.agent/workflows/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'auggie',
    'Auggie (Augment CLI)',
    '.augment',
    'adapter-backed',
    '.augment/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'bob',
    'Bob Shell',
    '.bob',
    'adapter-backed',
    '.bob/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'claude',
    'Claude Code',
    '.claude',
    'adapter-backed',
    '.claude/commands/opsx/{workflow}.md',
    'markdown',
    'namespaced',
    '/',
  ],
  [
    'cline',
    'Cline',
    '.cline',
    'adapter-backed',
    '.clinerules/workflows/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'command-code',
    'Command Code',
    '.commandcode',
    'adapter-backed',
    '.commandcode/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  ['codeartsagent', 'CodeArts', '.codeartsdoer', 'none', null, null, null, null],
  ['codex', 'Codex', '.agents', 'skills-invocable', null, null, null, null],
  [
    'devin',
    'Devin Desktop (formerly Windsurf)',
    '.devin',
    'adapter-backed',
    '.devin/workflows/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  ['forgecode', 'ForgeCode', '.forge', 'none', null, null, null, null],
  [
    'codebuddy',
    'CodeBuddy Code (CLI)',
    '.codebuddy',
    'adapter-backed',
    '.codebuddy/commands/opsx/{workflow}.md',
    'markdown',
    'namespaced',
    '/',
  ],
  [
    'continue',
    'Continue',
    '.continue',
    'adapter-backed',
    '.continue/prompts/opsx-{workflow}.prompt',
    'markdown',
    'flat',
    '/',
  ],
  [
    'costrict',
    'CoStrict',
    '.cospec',
    'adapter-backed',
    '.cospec/openspec/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'crush',
    'Crush',
    '.crush',
    'adapter-backed',
    '.crush/commands/opsx/{workflow}.md',
    'markdown',
    'namespaced',
    '/',
  ],
  [
    'cursor',
    'Cursor',
    '.cursor',
    'adapter-backed',
    '.cursor/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'factory',
    'Factory Droid',
    '.factory',
    'adapter-backed',
    '.factory/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'gemini',
    'Gemini CLI',
    '.gemini',
    'adapter-backed',
    '.gemini/commands/opsx/{workflow}.toml',
    'toml',
    'namespaced',
    '/',
  ],
  [
    'github-copilot',
    'GitHub Copilot',
    '.github',
    'adapter-backed',
    '.github/prompts/opsx-{workflow}.prompt.md',
    'markdown',
    'flat',
    '/',
  ],
  ['hermes', 'Hermes Agent', '.hermes', 'none', null, null, null, null],
  [
    'iflow',
    'iFlow',
    '.iflow',
    'adapter-backed',
    '.iflow/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'junie',
    'Junie',
    '.junie',
    'adapter-backed',
    '.junie/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'kilocode',
    'Kilo Code',
    '.kilocode',
    'adapter-backed',
    '.kilocode/workflows/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  ['kimi', 'Kimi Code', '.kimi-code', 'none', null, null, null, null],
  [
    'kiro',
    'Kiro',
    '.kiro',
    'adapter-backed',
    '.kiro/prompts/opsx-{workflow}.prompt.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'lingma',
    'Lingma',
    '.lingma',
    'adapter-backed',
    '.lingma/commands/opsx/{workflow}.md',
    'markdown',
    'namespaced',
    '/',
  ],
  ['minimax-code', 'MiniMax Code', null, 'skills-invocable', null, null, null, null],
  ['vibe', 'Mistral Vibe', '.vibe', 'none', null, null, null, null],
  [
    'oh-my-pi',
    'Oh My Pi',
    '.omp',
    'adapter-backed',
    '.omp/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'opencode',
    'OpenCode',
    '.opencode',
    'adapter-backed',
    '.opencode/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  ['pi', 'Pi', '.pi', 'adapter-backed', '.pi/prompts/opsx-{workflow}.md', 'markdown', 'flat', '/'],
  [
    'qoder',
    'Qoder',
    '.qoder',
    'adapter-backed',
    '.qoder/commands/opsx/{workflow}.md',
    'markdown',
    'namespaced',
    '/',
  ],
  [
    'qwen',
    'Qwen Code',
    '.qwen',
    'adapter-backed',
    '.qwen/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  ['rovodev', 'Rovo Dev CLI', '.rovodev', 'skills-invocable', null, null, null, null],
  [
    'roocode',
    'Zoo Code',
    '.roo',
    'adapter-backed',
    '.roo/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'trae',
    'Trae',
    '.trae',
    'adapter-backed',
    '.trae/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
  [
    'zcode',
    'ZCode',
    '.zcode',
    'adapter-backed',
    '.zcode/commands/opsx/{workflow}.md',
    'markdown',
    'namespaced',
    '/',
  ],
  ['agents', 'Shared .agents skills', '.agents', 'skills-invocable', null, null, null, null],
] as const satisfies readonly ExpectedTool[]

function registryEntry(registry: readonly ToolConfig[], toolId: string): ToolConfig | undefined {
  return registry.find((tool) => tool.value === toolId)
}

function requireRegistryEntry(registry: readonly ToolConfig[], toolId: string): ToolConfig {
  const tool = registryEntry(registry, toolId)
  if (!tool) throw new Error(`Missing required Agent registry fixture: ${toolId}`)
  return tool
}

function projectRegistry(registry: readonly ToolConfig[]): ExpectedTool[] {
  return registry.map((tool) => [
    tool.value,
    tool.name,
    tool.skillsDir,
    tool.capability,
    tool.command?.pathTemplate ?? null,
    tool.command?.format ?? null,
    tool.command?.invocation.style ?? null,
    tool.command?.invocation.prefix ?? null,
  ])
}

function assertPinnedRegistry(registry: readonly ToolConfig[]): void {
  expect(projectRegistry(registry)).toEqual(OFFICIAL_REGISTRY)
  expect(registry.filter((tool) => tool.requiresIdeRestart).map((tool) => tool.value)).toEqual([
    ...EXPECTED_RESTART_TOOLS,
  ])
  expect(registryEntry(registry, 'agents')).toEqual(
    expect.objectContaining({
      available: true,
      skillsDir: '.agents',
      detectionPaths: ['.agents/skills'],
      capability: 'skills-invocable',
    })
  )
  expect(registryEntry(registry, 'github-copilot')?.detectionPaths).toEqual([
    '.github/copilot-instructions.md',
    '.github/instructions',
    '.github/workflows/copilot-setup-steps.yml',
    '.github/prompts',
    '.github/agents',
    '.github/skills',
    '.github/.mcp.json',
  ])
  expect(registryEntry(registry, 'hermes')).toEqual(
    expect.objectContaining({
      detectionPaths: ['.hermes', 'HERMES.md', '.hermes.md'],
      setupNote: expect.stringContaining('skills.external_dirs'),
    })
  )
  expect(registryEntry(registry, 'kimi')).toEqual(
    expect.objectContaining({
      detectionPaths: ['.kimi-code', '.kimi'],
      migrations: [{ from: '.kimi', to: '.kimi-code', needsConsent: false }],
    })
  )
  expect(registryEntry(registry, 'devin')).toEqual(
    expect.objectContaining({
      detectionPaths: ['.devin', '.windsurf'],
      aliases: ['windsurf'],
      migrations: [{ from: '.windsurf', to: '.devin', needsConsent: true }],
    })
  )
  expect(registryEntry(registry, 'codex')).toEqual(
    expect.objectContaining({
      skillsDir: '.agents',
      legacySkillsDirs: ['.codex'],
      detectionPaths: ['.agents/skills', '.codex/skills'],
      migrations: [{ from: '.codex', to: '.agents', needsConsent: false }],
    })
  )
  expect(registryEntry(registry, 'codex')?.cleanup).toEqual(
    expect.objectContaining({
      kind: 'managed-global-prompts',
      managedFiles: expect.objectContaining({
        'opsx-explore.md': ['explore'],
        'opsx-bulk-archive.md': ['bulk-archive'],
      }),
    })
  )
  expect(registryEntry(registry, 'minimax-code')).toEqual(
    expect.objectContaining({
      available: true,
      skillsDir: null,
      globalSkillsDir: '.minimax',
      capability: 'skills-invocable',
    })
  )
  expect(registryEntry(registry, 'rovodev')).toEqual(
    expect.objectContaining({
      skillsDir: '.rovodev',
      detectionPaths: ['.rovodev/skills', '.rovodev'],
      capability: 'skills-invocable',
    })
  )
  expect(registryEntry(registry, 'command-code')?.command).toEqual(
    expect.objectContaining({
      pathTemplate: '.commandcode/commands/opsx-{workflow}.md',
      format: 'markdown',
    })
  )
}

function cloneRegistry(): ToolConfig[] {
  return structuredClone(AI_TOOLS)
}

function contentSignature(tool: ToolConfig): string | null {
  const content = tool.command?.content
  if (!content) return null
  if (content.kind === 'toml') return `toml:${content.fields.join(',')}`
  const frontmatter =
    content.frontmatter.kind === 'yaml' ? `yaml:${content.frontmatter.fields.join(',')}` : 'none'
  return `${frontmatter}|${content.bodyLayout}`
}

const EXPECTED_RESTART_TOOLS = [
  'amazon-q',
  'antigravity',
  'cline',
  'devin',
  'continue',
  'costrict',
  'cursor',
  'github-copilot',
  'junie',
  'kilocode',
  'kiro',
  'lingma',
  'qoder',
  'roocode',
  'trae',
] as const

describe('OpenSpec 1.9 Agent delivery registry', () => {
  it('preserves the complete pinned metadata, command format, and invocation contract', () => {
    assertPinnedRegistry(AI_TOOLS)
  })

  it('does not expose retired Windsurf as a current registry entry', () => {
    expect(registryEntry(AI_TOOLS, 'windsurf')).toBeUndefined()
  })

  it('selects the 1.8 official inventory without Command Code or restart facts', () => {
    const selected = selectAgentDeliveryRegistry('1.8.0')

    const ids = selected.map((tool) => tool.value)
    expect(ids).not.toContain('command-code')
    expect(ids).toHaveLength(AI_TOOLS.length - 1)
    // 1.8 declares no IDE restart metadata; no tool may carry a 1.9-only restart fact.
    expect(selected.every((tool) => tool.requiresIdeRestart === undefined)).toBe(true)
    // Shared targets and Codex current/legacy roots stay exactly as 1.8 ships them.
    expect(ids).toContain('agents')
    expect(registryEntry(selected, 'codex')?.skillsDir).toBe('.agents')
  })

  it('selects the full 1.9 inventory with Command Code and restart facts', () => {
    const selected = selectAgentDeliveryRegistry('1.9.1')

    expect(selected.map((tool) => tool.value)).toEqual(AI_TOOLS.map((tool) => tool.value))
    expect(registryEntry(selected, 'command-code')?.command?.pathTemplate).toBe(
      '.commandcode/commands/opsx-{workflow}.md'
    )
    expect(registryEntry(selected, 'amazon-q')?.requiresIdeRestart).toBe(true)
  })

  it('selects no inventory for non-admitted or unparseable versions', () => {
    // A page-level version bypass must not manufacture a 1.9 inventory: prereleases, the
    // next series, below-range lines, and unparseable output all select zero tools.
    expect(selectAgentDeliveryRegistry('1.9.0-rc.1')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.10.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('2.0.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.7.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('garbage')).toEqual([])
    expect(selectAgentDeliveryRegistry(null)).toEqual([])
  })

  it('declares IDE restart requirements exactly where the official registry does', () => {
    const restartTools = AI_TOOLS.filter((tool) => tool.requiresIdeRestart).map(
      (tool) => tool.value
    )
    expect(restartTools).toEqual([...EXPECTED_RESTART_TOOLS])
  })

  it('preserves every adapter content format instead of inferring it from file extension', () => {
    expect(
      Object.fromEntries(
        AI_TOOLS.filter((tool) => tool.command).map((tool) => [tool.value, contentSignature(tool)])
      )
    ).toEqual({
      'amazon-q': 'yaml:description|direct',
      antigravity: 'yaml:description|direct',
      auggie: 'yaml:description,argument-hint|direct',
      bob: 'yaml:description,argument-hint|direct',
      claude: 'yaml:name,description,allowed-tools,category,tags|direct',
      cline: 'none|headings',
      'command-code': 'none|direct',
      devin: 'yaml:name,description,category,tags|direct',
      codebuddy: 'yaml:name,description,argument-hint|direct',
      continue: 'yaml:name,description,invokable|direct',
      costrict: 'yaml:description,argument-hint|direct',
      crush: 'yaml:name,description,category,tags|direct',
      cursor: 'yaml:name,id,category,description|direct',
      factory: 'yaml:description,argument-hint|direct',
      gemini: 'toml:description,prompt',
      'github-copilot': 'yaml:description|direct',
      iflow: 'yaml:name,id,category,description|direct',
      junie: 'yaml:description|direct',
      kilocode: 'none|direct',
      kiro: 'yaml:description|direct',
      lingma: 'yaml:name,description,category,tags|direct',
      'oh-my-pi': 'yaml:description|direct',
      opencode: 'yaml:description|direct',
      pi: 'yaml:description|direct',
      qoder: 'yaml:name,description,category,tags|direct',
      qwen: 'yaml:description|direct',
      roocode: 'none|headings',
      trae: 'yaml:name,description|direct',
      zcode: 'yaml:name,description,category,tags|direct',
    })
  })

  it.each([
    ['tool', (registry: ToolConfig[]) => registry.splice(7, 1)],
    [
      'capability',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'codex'), { capability: 'none' }),
    ],
    [
      'detection path',
      (registry: ToolConfig[]) => {
        const githubCopilot = requireRegistryEntry(registry, 'github-copilot')
        const detectionPaths = githubCopilot.detectionPaths
        if (!detectionPaths) throw new Error('GitHub Copilot detection paths fixture is missing.')
        githubCopilot.detectionPaths = detectionPaths.slice(1)
      },
    ],
    [
      'alias',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'devin'), { aliases: [] }),
    ],
    [
      'cleanup path',
      (registry: ToolConfig[]) => {
        const cleanup = registryEntry(registry, 'codex')?.cleanup
        if (cleanup?.kind === 'managed-global-prompts') {
          cleanup.managedFiles = Object.fromEntries(
            Object.entries(cleanup.managedFiles).filter(
              ([fileName]) => fileName !== 'opsx-explore.md'
            )
          )
        }
      },
    ],
    [
      'physical command mapping',
      (registry: ToolConfig[]) => {
        const qwen = registryEntry(registry, 'qwen')
        if (qwen?.command) qwen.command.pathTemplate = '.qwen/commands/opsx-{workflow}.toml'
      },
    ],
    [
      'legacy skills root',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'codex'), { legacySkillsDirs: [] }),
    ],
    [
      'global skills root',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'minimax-code'), { globalSkillsDir: null }),
    ],
    [
      'IDE restart requirement',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'cursor'), { requiresIdeRestart: false }),
    ],
  ] as const)('rejects a registry mutation that removes one %s', (_label, mutate) => {
    const registry = cloneRegistry()
    mutate(registry)
    expect(() => assertPinnedRegistry(registry)).toThrow()
  })
})
