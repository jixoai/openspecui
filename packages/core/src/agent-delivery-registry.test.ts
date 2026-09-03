/**
 * Orthogonal intents (updated 2026-09-03 Asia/Shanghai):
 * 1. Lock the complete pinned OpenSpec 1.12 Agent delivery registry at the public Core boundary.
 * 2. Prove capability, command format/invocation, alias, detection, setup, cleanup, migration,
 *    global skill roots, legacy roots, and IDE restart facts stay co-located.
 * 3. Prove the 1.12 snapshot inherits every 1.11 physical fact (Antigravity `.agents`-current
 *    with `.agent` legacy/migration; zed skills-only from '1.10') and adds SourceCraft Code
 *    Assistant with `minCliSeries '1.12'`.
 * 4. Prove version-selected inventories admit only stable 1.12.x — retired 1.10.x/1.11.x lines
 *    select nothing — and declare the three-valued shared-root owner candidate set exactly
 *    as the pinned upstream source does.
 * 5. Provide explicit mutation-resistance evidence for every load-bearing registry dimension.
 *
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Review correction (2026-08-02): checked mutation fixtures must not bypass fabricated-state nullability.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 * Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */

import { describe, expect, it } from 'vitest'
import {
  AGENT_DELIVERY_REGISTRY,
  parseOpenSpecCliSeries,
  selectAgentDeliveryRegistry,
  SHARED_AGENTS_SKILLS_OWNER_CANDIDATES,
  SHARED_AGENTS_SKILLS_ROOT,
  SHARED_SKILLS_TARGET_MARKER,
} from './agent-delivery-registry.js'
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
    '.agents',
    'adapter-backed',
    '.agents/workflows/opsx-{workflow}.md',
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
    'codeassistant',
    'SourceCraft Code Assistant',
    '.codeassistant',
    'adapter-backed',
    '.codeassistant/commands/opsx-{workflow}.md',
    'markdown',
    'flat',
    '/',
  ],
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
  ['zed', 'Zed Agent', '.agents', 'none', null, null, null, null],
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

const ANTIGRAVITY_111_MIGRATION = [
  { from: '.agent', to: '.agents', needsConsent: false, timing: 'after-generation' },
] as const

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
      // Upstream migrates Codex after the replacement is generated so divergent
      // legacy files are kept rather than overwritten.
      migrations: [
        { from: '.codex', to: '.agents', needsConsent: false, timing: 'after-generation' },
      ],
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
  // 1.12 base (inherited from 1.11): Antigravity's current roots live at the shared
  // `.agents` root while `.agent` stays readable for detection and migrates only after
  // replacement generation.
  expect(registryEntry(registry, 'antigravity')).toEqual(
    expect.objectContaining({
      skillsDir: '.agents',
      legacySkillsDirs: ['.agent'],
      detectionPaths: ['.agent', '.agents/workflows'],
      command: expect.objectContaining({
        pathTemplate: '.agents/workflows/opsx-{workflow}.md',
        format: 'markdown',
      }),
      migrations: [...ANTIGRAVITY_111_MIGRATION],
      requiresIdeRestart: true,
    })
  )
  // Cleanup stays scoped to pre-opsx filenames under the former root:
  // upstream never lists the shared root because users may keep their own files there.
  expect(registryEntry(registry, 'antigravity')?.cleanup).toEqual({
    kind: 'project-patterns',
    patterns: ['.agent/workflows/openspec-*.md'],
  })
  // Zed Agent joined on 1.10 (provenance kept typed): skills-only, shared root, no
  // command adapter, no restart fact.
  expect(registryEntry(registry, 'zed')).toEqual(
    expect.objectContaining({
      name: 'Zed Agent',
      available: true,
      successLabel: 'Zed Agent',
      skillsDir: '.agents',
      detectionPaths: ['.zed', '.agents/skills'],
      capability: 'none',
      command: null,
      minCliSeries: '1.10',
    })
  )
  expect(registryEntry(registry, 'zed')?.requiresIdeRestart).toBeUndefined()
  // SourceCraft Code Assistant enters with 1.12: description-only YAML commands under
  // the default `.codeassistant` detection root, natural-language skill references
  // (upstream `NATURAL_LANGUAGE_SKILL_TOOLS`, like rovodev — but with command files,
  // unlike rovodev), no IDE restart fact, no cleanup, no migrations.
  expect(registryEntry(registry, 'codeassistant')).toEqual(
    expect.objectContaining({
      name: 'SourceCraft Code Assistant',
      available: true,
      successLabel: 'SourceCraft Code Assistant',
      skillsDir: '.codeassistant',
      capability: 'adapter-backed',
      command: expect.objectContaining({
        pathTemplate: '.codeassistant/commands/opsx-{workflow}.md',
        format: 'markdown',
      }),
      minCliSeries: '1.12',
    })
  )
  expect(registryEntry(registry, 'codeassistant')?.detectionPaths).toBeUndefined()
  expect(registryEntry(registry, 'codeassistant')?.requiresIdeRestart).toBeUndefined()
  expect(registryEntry(registry, 'codeassistant')?.cleanup).toBeUndefined()
  expect(registryEntry(registry, 'codeassistant')?.migrations).toBeUndefined()
  expect(registryEntry(registry, 'codeassistant')?.legacySkillsDirs).toBeUndefined()
}

/** Assert the admitted per-series inventory against the selection boundary itself. */
function assertAdmittedSeriesInventories(): void {
  const series112 = selectAgentDeliveryRegistry('1.12.0')

  // The admitted line ships the complete official tool set: every 1.11 tool keeps its
  // physical facts and codeassistant (minCliSeries '1.12') joins; zed's provenance
  // stays '1.10' without gating the 1.12 inventory.
  expect(series112.map((tool) => tool.value)).toEqual(AI_TOOLS.map((tool) => tool.value))
  expect(series112.some((tool) => tool.value === 'codeassistant')).toBe(true)

  // 1.12 inherits 1.11's Antigravity reality: current roots at the shared `.agents`
  // root with `.agent` as legacy + after-generation migration evidence.
  expect(registryEntry(series112, 'antigravity')).toEqual(
    expect.objectContaining({
      skillsDir: '.agents',
      legacySkillsDirs: ['.agent'],
      detectionPaths: ['.agent', '.agents/workflows'],
      command: expect.objectContaining({
        pathTemplate: '.agents/workflows/opsx-{workflow}.md',
      }),
      migrations: [...ANTIGRAVITY_111_MIGRATION],
    })
  )

  // IDE restart facts are declared on the admitted line exactly where upstream does,
  // and never on the skills-only zed / shared / codex targets or codeassistant.
  expect(series112.filter((tool) => tool.requiresIdeRestart).map((tool) => tool.value)).toEqual([
    ...EXPECTED_RESTART_TOOLS,
  ])
  expect(registryEntry(series112, 'zed')?.requiresIdeRestart).toBeUndefined()
  expect(registryEntry(series112, 'codeassistant')?.requiresIdeRestart).toBeUndefined()
  for (const candidate of SHARED_AGENTS_SKILLS_OWNER_CANDIDATES) {
    expect(registryEntry(series112, candidate)?.skillsDir).toBe('.agents')
  }

  // Selected snapshots are plain per-series inventories: the override mechanism stays internal.
  expect(series112.every((tool) => tool.perSeriesOverrides === undefined)).toBe(true)

  // Retired below-range lines select no inventory at all: the 1.10/1.11 v11 window
  // is not admitted by this release line, so it must not project a stale snapshot.
  expect(selectAgentDeliveryRegistry('1.11.3')).toEqual([])
  expect(selectAgentDeliveryRegistry('1.10.7')).toEqual([])
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

describe('OpenSpec 1.12 Agent delivery registry (pinned base)', () => {
  it('preserves the complete pinned metadata, command format, and invocation contract', () => {
    assertPinnedRegistry(AI_TOOLS)
  })

  it('does not expose retired Windsurf as a current registry entry', () => {
    expect(registryEntry(AI_TOOLS, 'windsurf')).toBeUndefined()
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
      codeassistant: 'yaml:description|direct',
      qoder: 'yaml:name,description,category,tags|direct',
      qwen: 'yaml:description|direct',
      roocode: 'none|headings',
      trae: 'yaml:name,description|direct',
      zcode: 'yaml:name,description,category,tags|direct',
    })
  })
})

describe('per-series inventory selection (1.12 single-series window)', () => {
  it('selects the 1.12 official inventory with codeassistant and the 1.11-inherited Antigravity roots', () => {
    assertAdmittedSeriesInventories()
  })

  it('selects no inventory for non-admitted or unparseable versions', () => {
    // A page-level version bypass must not manufacture an admitted inventory: prereleases,
    // the next series, below-range lines (including the retired 1.10/1.11 v11 window and
    // 1.8/1.9), and unparseable output all select zero tools.
    expect(selectAgentDeliveryRegistry('1.9.5')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.9.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.8.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.11.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.10.7')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.12.0-rc.1')).toEqual([])
    expect(selectAgentDeliveryRegistry('1.13.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('2.0.0')).toEqual([])
    expect(selectAgentDeliveryRegistry('garbage')).toEqual([])
    expect(selectAgentDeliveryRegistry(null)).toEqual([])
  })

  it.each([
    ['1.12.0', '1.12'],
    ['1.12.4', '1.12'],
  ])('parses stable %s as the %s Agent inventory line', (cliVersion, expectedSeries) => {
    expect(parseOpenSpecCliSeries(cliVersion)).toBe(expectedSeries)
  })

  it.each([
    '1.9.5',
    '1.8.0',
    '1.7.0',
    '1.10.7',
    '1.11.3',
    '1.13.0',
    '2.0.0',
    '1.12.0-rc.1',
    '1.11.0-beta.1',
    'garbage',
    '',
    null,
  ])('rejects %s as an admitted Agent inventory line', (cliVersion) => {
    expect(parseOpenSpecCliSeries(cliVersion)).toBeNull()
  })

  it('declares the three-valued shared .agents skills-root owner candidate set', () => {
    expect(SHARED_AGENTS_SKILLS_ROOT).toBe('.agents')
    expect(SHARED_SKILLS_TARGET_MARKER).toBe('.openspec-target')
    // Upstream arbitration order: `.openspec-target` marker, then inferred owner from
    // generated invocation syntax, then `agents` when current skills exist, then the
    // `codex` fallback. The registry declares candidates only; arbitration is owned by
    // the official CLI and projected by the Server Agent delivery service.
    expect(SHARED_AGENTS_SKILLS_OWNER_CANDIDATES).toEqual(['codex', 'zed', 'agents'])
    // Antigravity joined the shared root in 1.11 (carried forward on 1.12) but is
    // adapter-backed and is excluded from skills-writer candidacy; its own
    // `.agents/workflows` commands root is unaffected by that exclusion.
    expect(SHARED_AGENTS_SKILLS_OWNER_CANDIDATES).not.toContain('antigravity')
    expect(registryEntry(selectAgentDeliveryRegistry('1.12.0'), 'antigravity')?.capability).toBe(
      'adapter-backed'
    )
  })

  it('rejects removal of the zed entry from the admitted inventory', () => {
    const zedIndex = AI_TOOLS.findIndex((tool) => tool.value === 'zed')
    expect(zedIndex).toBeGreaterThan(-1)
    const [removed] = AI_TOOLS.splice(zedIndex, 1)
    try {
      expect(() => assertAdmittedSeriesInventories()).toThrow()
    } finally {
      AI_TOOLS.splice(zedIndex, 0, removed)
    }
  })

  it('rejects removal of the codeassistant entry from the admitted inventory', () => {
    const codeassistantIndex = AI_TOOLS.findIndex((tool) => tool.value === 'codeassistant')
    expect(codeassistantIndex).toBeGreaterThan(-1)
    const [removed] = AI_TOOLS.splice(codeassistantIndex, 1)
    try {
      expect(() => assertAdmittedSeriesInventories()).toThrow()
    } finally {
      AI_TOOLS.splice(codeassistantIndex, 0, removed)
    }
  })

  it('rejects stripping the Antigravity migration evidence from the 1.12 snapshot', () => {
    const antigravity = requireRegistryEntry(AI_TOOLS, 'antigravity')
    const migrations = antigravity.migrations
    antigravity.migrations = []
    try {
      expect(() => assertAdmittedSeriesInventories()).toThrow()
    } finally {
      antigravity.migrations = migrations
    }
  })
})

describe('registry mutation resistance', () => {
  it.each([
    [
      'tool',
      (registry: ToolConfig[]) =>
        registry.splice(
          registry.findIndex((tool) => tool.value === 'codeartsagent'),
          1
        ),
    ],
    [
      'zed entry',
      (registry: ToolConfig[]) =>
        registry.splice(
          registry.findIndex((tool) => tool.value === 'zed'),
          1
        ),
    ],
    [
      'codeassistant entry',
      (registry: ToolConfig[]) =>
        registry.splice(
          registry.findIndex((tool) => tool.value === 'codeassistant'),
          1
        ),
    ],
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
      'codeassistant command mapping',
      (registry: ToolConfig[]) => {
        const codeassistant = registryEntry(registry, 'codeassistant')
        if (codeassistant?.command)
          codeassistant.command.pathTemplate = '.codeassistant/skills/opsx-{workflow}.md'
      },
    ],
    [
      'codeassistant series gate',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'codeassistant'), { minCliSeries: '1.11' }),
    ],
    [
      'legacy skills root',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'codex'), { legacySkillsDirs: [] }),
    ],
    [
      'per-series migration evidence',
      (registry: ToolConfig[]) => {
        requireRegistryEntry(registry, 'antigravity').migrations = []
      },
    ],
    [
      'shared-root legacy root',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'antigravity'), { legacySkillsDirs: [] }),
    ],
    [
      'zed detection paths',
      (registry: ToolConfig[]) =>
        Object.assign(requireRegistryEntry(registry, 'zed'), { detectionPaths: ['.zed'] }),
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

  it('keeps the exported registry and the legacy alias the same physical owner', () => {
    expect(AGENT_DELIVERY_REGISTRY).toBe(AI_TOOLS)
  })
})
