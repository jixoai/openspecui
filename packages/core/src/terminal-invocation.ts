import { z } from 'zod'
import type { PtyPlatform } from './pty-protocol.js'

export interface TerminalShellEnv {
  SHELL?: string
  ComSpec?: string
}

export const TERMINAL_SHELL_QUOTE_STYLE_VALUES = ['posix', 'cmd', 'powershell'] as const
export const TERMINAL_COMMAND_FIELD_TYPE_VALUES = ['text', 'textarea', 'boolean', 'select'] as const

export const TerminalShellQuoteStyleSchema = z.enum(TERMINAL_SHELL_QUOTE_STYLE_VALUES)
export type TerminalShellQuoteStyle = z.infer<typeof TerminalShellQuoteStyleSchema>

export const TerminalShellProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  source: z.enum(['builtin', 'custom']).default('custom'),
  quoteStyle: TerminalShellQuoteStyleSchema.default('posix'),
})
export type TerminalShellProfile = z.infer<typeof TerminalShellProfileSchema>

export const TerminalCommandFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(TERMINAL_COMMAND_FIELD_TYPE_VALUES),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.union([z.string(), z.boolean()]).optional(),
  options: z.array(z.string()).default([]),
  required: z.boolean().default(false),
  advanced: z.boolean().default(false),
})
export type TerminalCommandField = z.infer<typeof TerminalCommandFieldSchema>

type TerminalCommandFieldInput = Omit<TerminalCommandField, 'advanced' | 'options' | 'required'> &
  Partial<Pick<TerminalCommandField, 'advanced' | 'options' | 'required'>>

function defineTerminalCommandField(field: TerminalCommandFieldInput): TerminalCommandField {
  return {
    ...field,
    options: field.options ?? [],
    required: field.required ?? false,
    advanced: field.advanced ?? false,
  }
}

function defineTerminalSpawnCommand(
  command: Omit<TerminalSpawnCommand, 'parameters' | 'source'> & {
    source?: TerminalSpawnCommand['source']
  }
): TerminalSpawnCommand {
  return {
    ...command,
    parameters: fieldsToTerminalCommandParameters(command.fields),
    source: command.source ?? 'builtin',
  }
}

const TerminalCommandArgumentSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('literal'),
    value: z.string(),
  }),
  z.object({
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    prefix: z.string().default(''),
    omitWhenEmpty: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('booleanFlag'),
    fieldId: z.string().min(1),
    flag: z.string().min(1),
  }),
])
export type TerminalCommandArgument = z.infer<typeof TerminalCommandArgumentSchema>

const TerminalCommandJsonSchemaPropertySchema = z.object({
  type: z.enum(['string', 'boolean']).default('string'),
  title: z.string().optional(),
  description: z.string().optional(),
  default: z.union([z.string(), z.boolean()]).optional(),
  enum: z.array(z.string()).optional(),
})
export type TerminalCommandJsonSchemaProperty = z.infer<
  typeof TerminalCommandJsonSchemaPropertySchema
>

const TerminalCommandJsonSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(TerminalCommandJsonSchemaPropertySchema).default({}),
  required: z.array(z.string()).default([]),
})
export type TerminalCommandJsonSchema = z.infer<typeof TerminalCommandJsonSchemaSchema>

const TerminalCommandParametersSchema = z.object({
  schema: TerminalCommandJsonSchemaSchema,
  uiSchema: z.record(z.unknown()).default({}),
})
export type TerminalCommandParameters = z.infer<typeof TerminalCommandParametersSchema>

const TerminalCommandBuilderPartSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('literal'),
    value: z.string(),
  }),
  z.object({
    kind: z.literal('field'),
    fieldId: z.string().min(1),
    prefix: z.string().default(''),
    omitWhenEmpty: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('booleanFlag'),
    fieldId: z.string().min(1),
    flag: z.string().min(1),
  }),
])
export type TerminalCommandBuilderPart = z.infer<typeof TerminalCommandBuilderPartSchema>

const TerminalCommandBuilderSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('argv'),
    parts: z.array(TerminalCommandBuilderPartSchema).default([]),
  }),
  z.object({
    kind: z.literal('shellLine'),
    template: z.string().default(''),
  }),
])
export type TerminalCommandBuilder = z.infer<typeof TerminalCommandBuilderSchema>

export const TerminalSpawnCommandSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  command: z.string().min(1),
  args: z.array(TerminalCommandArgumentSchema).default([]),
  fields: z.array(TerminalCommandFieldSchema).default([]),
  parameters: TerminalCommandParametersSchema.optional(),
  builder: TerminalCommandBuilderSchema.optional(),
  shellProfileId: z.string().optional(),
  source: z.enum(['builtin', 'custom']).default('custom'),
})
export type TerminalSpawnCommand = z.infer<typeof TerminalSpawnCommandSchema>

export const TerminalInvocationSettingsSchema = z.object({
  defaultShellProfileId: z.string().optional(),
  customShellProfiles: z.array(TerminalShellProfileSchema).default([]),
  customSpawnCommands: z.array(TerminalSpawnCommandSchema).default([]),
})
export type TerminalInvocationSettings = z.infer<typeof TerminalInvocationSettingsSchema>

export type TerminalCommandFieldValue = string | boolean
export type TerminalCommandFieldValues = Record<string, TerminalCommandFieldValue>
export type TerminalCommandRenderResult =
  | { kind: 'argv'; argv: string[] }
  | { kind: 'shellLine'; commandLine: string }

export interface TerminalShellDefaults {
  platform: PtyPlatform
  effectiveDefaultShell: TerminalShellProfile
  builtinShellProfiles: TerminalShellProfile[]
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  const result: T[] = []
  for (const item of items) {
    if (seen.has(item.id)) continue
    seen.add(item.id)
    result.push(item)
  }
  return result
}

function normalizeShellPath(input: string | undefined): string {
  return input?.trim() || ''
}

function getAmbientTerminalShellEnv(): TerminalShellEnv {
  if (typeof process === 'undefined') return {}
  return {
    SHELL: process.env.SHELL,
    ComSpec: process.env.ComSpec,
  }
}

export function resolveTerminalShellDefaults(options: {
  platform: PtyPlatform
  env?: TerminalShellEnv
}): TerminalShellDefaults {
  const env = options.env ?? getAmbientTerminalShellEnv()

  if (options.platform === 'windows') {
    const cmd = normalizeShellPath(env.ComSpec) || 'cmd.exe'
    const builtinShellProfiles: TerminalShellProfile[] = [
      {
        id: 'builtin:cmd',
        label: 'Command Prompt',
        command: cmd,
        args: [],
        source: 'builtin',
        quoteStyle: 'cmd',
      },
      {
        id: 'builtin:powershell',
        label: 'PowerShell',
        command: 'powershell.exe',
        args: [],
        source: 'builtin',
        quoteStyle: 'powershell',
      },
      {
        id: 'builtin:wsl-bash',
        label: 'WSL Bash',
        command: 'wsl.exe',
        args: ['bash'],
        source: 'builtin',
        quoteStyle: 'posix',
      },
    ]
    return {
      platform: options.platform,
      effectiveDefaultShell: builtinShellProfiles[0]!,
      builtinShellProfiles,
    }
  }

  const envShell = normalizeShellPath(env.SHELL)
  const fallbackShell: TerminalShellProfile = {
    id: 'builtin:sh',
    label: '/bin/sh',
    command: '/bin/sh',
    args: [],
    source: 'builtin',
    quoteStyle: 'posix',
  }
  const builtinShellProfiles = uniqueById<TerminalShellProfile>([
    fallbackShell,
    ...(envShell && envShell !== fallbackShell.command
      ? [
          {
            id: 'builtin:env-shell',
            label: `SHELL (${envShell})`,
            command: envShell,
            args: [],
            source: 'builtin' as const,
            quoteStyle: 'posix' as const,
          },
        ]
      : []),
  ])

  return {
    platform: options.platform,
    effectiveDefaultShell:
      builtinShellProfiles.find((profile) => profile.id === 'builtin:env-shell') ?? fallbackShell,
    builtinShellProfiles,
  }
}

const CLAUDE_COMMAND_FIELDS = [
  defineTerminalCommandField({
    id: 'prompt',
    label: 'Prompt',
    type: 'textarea',
    description: 'Initial prompt to send to Claude.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'model',
    label: 'Model',
    type: 'text',
    description: 'Claude model alias or full model name.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'permissionMode',
    label: 'Permission mode',
    type: 'select',
    description: 'Permission mode for this session.',
    defaultValue: '',
    options: ['', 'default', 'acceptEdits', 'auto', 'dontAsk', 'plan', 'bypassPermissions'],
    required: false,
  }),
  defineTerminalCommandField({
    id: 'effort',
    label: 'Effort',
    type: 'select',
    description: 'Reasoning effort for the current session.',
    defaultValue: '',
    options: ['', 'low', 'medium', 'high', 'xhigh', 'max'],
    required: false,
  }),
  defineTerminalCommandField({
    id: 'continueLatest',
    label: 'Continue latest',
    type: 'boolean',
    description: 'Continue the most recent conversation in the current directory.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'resumeSession',
    label: 'Resume session',
    type: 'text',
    description: 'Resume a conversation by session ID or picker search term.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'name',
    label: 'Session name',
    type: 'text',
    description: 'Display name for the Claude session.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'addDir',
    label: 'Additional dirs',
    type: 'text',
    description: 'Additional directories to allow tool access to.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'appendSystemPrompt',
    label: 'Append system prompt',
    type: 'textarea',
    description: 'Text appended to the default system prompt.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'allowedTools',
    label: 'Allowed tools',
    type: 'text',
    description: 'Comma or space-separated tool allowlist.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'disallowedTools',
    label: 'Disallowed tools',
    type: 'text',
    description: 'Comma or space-separated tool denylist.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'print',
    label: 'Print and exit',
    type: 'boolean',
    description: 'Run in non-interactive print mode.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'outputFormat',
    label: 'Output format',
    type: 'select',
    description: 'Output format for print mode.',
    defaultValue: '',
    options: ['', 'text', 'json', 'stream-json'],
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'dangerouslySkipPermissions',
    label: 'Skip permissions',
    type: 'boolean',
    description: 'Bypass all permission checks. Use only in externally sandboxed workspaces.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'allowDangerouslySkipPermissions',
    label: 'Allow skip permissions',
    type: 'boolean',
    description: 'Expose the skip-permissions option without enabling it by default.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'bare',
    label: 'Bare mode',
    type: 'boolean',
    description: 'Minimal mode that skips hooks, plugin sync, memory, and auto-discovery.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'verbose',
    label: 'Verbose',
    type: 'boolean',
    description: 'Override verbose mode setting from config.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
]

const CODEX_COMMAND_FIELDS = [
  defineTerminalCommandField({
    id: 'prompt',
    label: 'Prompt',
    type: 'textarea',
    description: 'Initial prompt to send to Codex.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'model',
    label: 'Model',
    type: 'text',
    description: 'Model the agent should use.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'profile',
    label: 'Profile',
    type: 'text',
    description: 'Configuration profile from config.toml.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'sandbox',
    label: 'Sandbox',
    type: 'select',
    description: 'Sandbox policy for model-generated commands.',
    defaultValue: '',
    options: ['', 'read-only', 'workspace-write', 'danger-full-access'],
    required: false,
  }),
  defineTerminalCommandField({
    id: 'approvalPolicy',
    label: 'Approval policy',
    type: 'select',
    description: 'When Codex should ask for human approval.',
    defaultValue: '',
    options: ['', 'untrusted', 'on-request', 'never'],
    required: false,
  }),
  defineTerminalCommandField({
    id: 'search',
    label: 'Web search',
    type: 'boolean',
    description: 'Enable live web search for the session.',
    defaultValue: false,
    required: false,
  }),
  defineTerminalCommandField({
    id: 'cd',
    label: 'Working root',
    type: 'text',
    description: 'Directory Codex should use as its working root.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'addDir',
    label: 'Additional dir',
    type: 'text',
    description: 'Additional writable directory alongside the primary workspace.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'config',
    label: 'Config override',
    type: 'text',
    description: 'Configuration override in key=value form.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'enableFeature',
    label: 'Enable feature',
    type: 'text',
    description: 'Feature flag to enable.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'disableFeature',
    label: 'Disable feature',
    type: 'text',
    description: 'Feature flag to disable.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'image',
    label: 'Image file',
    type: 'text',
    description: 'Image file to attach to the initial prompt.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'oss',
    label: 'OSS provider',
    type: 'boolean',
    description: 'Use an open-source provider.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'localProvider',
    label: 'Local provider',
    type: 'select',
    description: 'Local provider to use with OSS mode.',
    defaultValue: '',
    options: ['', 'lmstudio', 'ollama'],
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'noAltScreen',
    label: 'No alt screen',
    type: 'boolean',
    description: 'Disable alternate screen mode.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'dangerouslyBypassApprovalsAndSandbox',
    label: 'Bypass approvals and sandbox',
    type: 'boolean',
    description: 'Skip all confirmation prompts and execute without sandboxing.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
]

const GEMINI_COMMAND_FIELDS = [
  defineTerminalCommandField({
    id: 'prompt',
    label: 'Prompt',
    type: 'textarea',
    description: 'Initial prompt to send to Gemini.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'model',
    label: 'Model',
    type: 'text',
    description: 'Model Gemini CLI should use.',
    defaultValue: '',
    required: false,
  }),
  defineTerminalCommandField({
    id: 'approvalMode',
    label: 'Approval mode',
    type: 'select',
    description: 'Approval mode for tool execution.',
    defaultValue: '',
    options: ['', 'default', 'auto_edit', 'yolo', 'plan'],
    required: false,
  }),
  defineTerminalCommandField({
    id: 'sandbox',
    label: 'Sandbox',
    type: 'boolean',
    description: 'Run Gemini in sandbox mode.',
    defaultValue: false,
    required: false,
  }),
  defineTerminalCommandField({
    id: 'debug',
    label: 'Debug',
    type: 'boolean',
    description: 'Run in debug mode.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'worktree',
    label: 'Worktree',
    type: 'text',
    description: 'Start Gemini in a named new git worktree.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'yolo',
    label: 'YOLO mode',
    type: 'boolean',
    description: 'Automatically accept all actions.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'policy',
    label: 'Policy',
    type: 'text',
    description: 'Additional policy files or directories.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'adminPolicy',
    label: 'Admin policy',
    type: 'text',
    description: 'Additional admin policy files or directories.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'extensions',
    label: 'Extensions',
    type: 'text',
    description: 'Extensions to use.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'includeDirectories',
    label: 'Include directories',
    type: 'text',
    description: 'Additional directories to include in the workspace.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'allowedMcpServerNames',
    label: 'Allowed MCP servers',
    type: 'text',
    description: 'Allowed MCP server names.',
    defaultValue: '',
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'outputFormat',
    label: 'Output format',
    type: 'select',
    description: 'Gemini CLI output format.',
    defaultValue: '',
    options: ['', 'text', 'json', 'stream-json'],
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'screenReader',
    label: 'Screen reader',
    type: 'boolean',
    description: 'Enable screen reader mode.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'rawOutput',
    label: 'Raw output',
    type: 'boolean',
    description: 'Disable output sanitization.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
  defineTerminalCommandField({
    id: 'acceptRawOutputRisk',
    label: 'Accept raw output risk',
    type: 'boolean',
    description: 'Suppress the raw-output security warning.',
    defaultValue: false,
    required: false,
    advanced: true,
  }),
]

export const BUILTIN_TERMINAL_SPAWN_COMMANDS: readonly TerminalSpawnCommand[] = [
  defineTerminalSpawnCommand({
    id: 'builtin:claude',
    label: 'Claude',
    description: 'Create a terminal and invoke Claude with an optional prompt.',
    command: 'claude',
    args: [
      {
        kind: 'booleanFlag',
        fieldId: 'dangerouslySkipPermissions',
        flag: '--dangerously-skip-permissions',
      },
      {
        kind: 'booleanFlag',
        fieldId: 'allowDangerouslySkipPermissions',
        flag: '--allow-dangerously-skip-permissions',
      },
      { kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
    ],
    fields: CLAUDE_COMMAND_FIELDS,
    builder: {
      kind: 'argv',
      parts: [
        { kind: 'literal', value: 'claude' },
        { kind: 'field', fieldId: 'model', prefix: '--model=', omitWhenEmpty: true },
        {
          kind: 'field',
          fieldId: 'permissionMode',
          prefix: '--permission-mode=',
          omitWhenEmpty: true,
        },
        { kind: 'field', fieldId: 'effort', prefix: '--effort=', omitWhenEmpty: true },
        { kind: 'booleanFlag', fieldId: 'continueLatest', flag: '--continue' },
        { kind: 'field', fieldId: 'resumeSession', prefix: '--resume=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'name', prefix: '--name=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'addDir', prefix: '--add-dir=', omitWhenEmpty: true },
        {
          kind: 'field',
          fieldId: 'appendSystemPrompt',
          prefix: '--append-system-prompt=',
          omitWhenEmpty: true,
        },
        {
          kind: 'field',
          fieldId: 'allowedTools',
          prefix: '--allowed-tools=',
          omitWhenEmpty: true,
        },
        {
          kind: 'field',
          fieldId: 'disallowedTools',
          prefix: '--disallowed-tools=',
          omitWhenEmpty: true,
        },
        { kind: 'booleanFlag', fieldId: 'print', flag: '--print' },
        { kind: 'field', fieldId: 'outputFormat', prefix: '--output-format=', omitWhenEmpty: true },
        {
          kind: 'booleanFlag',
          fieldId: 'dangerouslySkipPermissions',
          flag: '--dangerously-skip-permissions',
        },
        {
          kind: 'booleanFlag',
          fieldId: 'allowDangerouslySkipPermissions',
          flag: '--allow-dangerously-skip-permissions',
        },
        { kind: 'booleanFlag', fieldId: 'bare', flag: '--bare' },
        { kind: 'booleanFlag', fieldId: 'verbose', flag: '--verbose' },
        { kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
      ],
    },
  }),
  defineTerminalSpawnCommand({
    id: 'builtin:codex',
    label: 'Codex',
    description: 'Create a terminal and invoke Codex with an optional prompt.',
    command: 'codex',
    args: [
      {
        kind: 'booleanFlag',
        fieldId: 'dangerouslyBypassApprovalsAndSandbox',
        flag: '--dangerously-bypass-approvals-and-sandbox',
      },
      { kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
    ],
    fields: CODEX_COMMAND_FIELDS,
    builder: {
      kind: 'argv',
      parts: [
        { kind: 'literal', value: 'codex' },
        { kind: 'field', fieldId: 'model', prefix: '--model=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'profile', prefix: '--profile=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'sandbox', prefix: '--sandbox=', omitWhenEmpty: true },
        {
          kind: 'field',
          fieldId: 'approvalPolicy',
          prefix: '--ask-for-approval=',
          omitWhenEmpty: true,
        },
        { kind: 'booleanFlag', fieldId: 'search', flag: '--search' },
        { kind: 'field', fieldId: 'cd', prefix: '--cd=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'addDir', prefix: '--add-dir=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'config', prefix: '--config=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'enableFeature', prefix: '--enable=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'disableFeature', prefix: '--disable=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'image', prefix: '--image=', omitWhenEmpty: true },
        { kind: 'booleanFlag', fieldId: 'oss', flag: '--oss' },
        {
          kind: 'field',
          fieldId: 'localProvider',
          prefix: '--local-provider=',
          omitWhenEmpty: true,
        },
        { kind: 'booleanFlag', fieldId: 'noAltScreen', flag: '--no-alt-screen' },
        {
          kind: 'booleanFlag',
          fieldId: 'dangerouslyBypassApprovalsAndSandbox',
          flag: '--dangerously-bypass-approvals-and-sandbox',
        },
        { kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
      ],
    },
  }),
  defineTerminalSpawnCommand({
    id: 'builtin:gemini',
    label: 'Gemini',
    description: 'Create a terminal and invoke Gemini with an optional prompt.',
    command: 'gemini',
    args: [
      { kind: 'booleanFlag', fieldId: 'yolo', flag: '--yolo' },
      { kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
    ],
    fields: GEMINI_COMMAND_FIELDS,
    builder: {
      kind: 'argv',
      parts: [
        { kind: 'literal', value: 'gemini' },
        { kind: 'booleanFlag', fieldId: 'debug', flag: '--debug' },
        { kind: 'field', fieldId: 'model', prefix: '--model=', omitWhenEmpty: true },
        {
          kind: 'field',
          fieldId: 'approvalMode',
          prefix: '--approval-mode=',
          omitWhenEmpty: true,
        },
        { kind: 'booleanFlag', fieldId: 'sandbox', flag: '--sandbox' },
        { kind: 'field', fieldId: 'worktree', prefix: '--worktree=', omitWhenEmpty: true },
        { kind: 'booleanFlag', fieldId: 'yolo', flag: '--yolo' },
        { kind: 'field', fieldId: 'policy', prefix: '--policy=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'adminPolicy', prefix: '--admin-policy=', omitWhenEmpty: true },
        { kind: 'field', fieldId: 'extensions', prefix: '--extensions=', omitWhenEmpty: true },
        {
          kind: 'field',
          fieldId: 'includeDirectories',
          prefix: '--include-directories=',
          omitWhenEmpty: true,
        },
        {
          kind: 'field',
          fieldId: 'allowedMcpServerNames',
          prefix: '--allowed-mcp-server-names=',
          omitWhenEmpty: true,
        },
        { kind: 'field', fieldId: 'outputFormat', prefix: '--output-format=', omitWhenEmpty: true },
        { kind: 'booleanFlag', fieldId: 'screenReader', flag: '--screen-reader' },
        { kind: 'booleanFlag', fieldId: 'rawOutput', flag: '--raw-output' },
        {
          kind: 'booleanFlag',
          fieldId: 'acceptRawOutputRisk',
          flag: '--accept-raw-output-risk',
        },
        { kind: 'field', fieldId: 'prompt', prefix: '', omitWhenEmpty: true },
      ],
    },
  }),
]

function fieldToJsonSchemaProperty(field: TerminalCommandField): TerminalCommandJsonSchemaProperty {
  const base: Pick<TerminalCommandJsonSchemaProperty, 'title' | 'description'> = {
    title: field.label,
  }
  const description = field.description ?? field.placeholder
  if (description) {
    base.description = description
  }
  if (field.type === 'boolean') {
    return {
      ...base,
      type: 'boolean',
      default: typeof field.defaultValue === 'boolean' ? field.defaultValue : false,
    }
  }
  if (field.type === 'select') {
    return {
      ...base,
      type: 'string',
      enum: field.options,
      default: typeof field.defaultValue === 'string' ? field.defaultValue : field.options[0],
    }
  }
  return {
    ...base,
    type: 'string',
    default: typeof field.defaultValue === 'string' ? field.defaultValue : '',
  }
}

export function fieldsToTerminalCommandParameters(
  fields: readonly TerminalCommandField[]
): TerminalCommandParameters {
  const properties: Record<string, TerminalCommandJsonSchemaProperty> = {}
  const uiSchema: Record<string, Record<string, unknown>> = {}
  const required: string[] = []
  for (const field of fields) {
    properties[field.id] = fieldToJsonSchemaProperty(field)
    if (field.required) required.push(field.id)
    if (field.type === 'textarea') {
      uiSchema[field.id] = {
        'ui:widget': 'textarea',
      }
    }
    if (field.advanced) {
      const current = uiSchema[field.id] ?? {}
      uiSchema[field.id] = {
        ...current,
        'ui:advanced': true,
      }
    }
  }
  return {
    schema: {
      type: 'object',
      properties,
      required,
    },
    uiSchema,
  }
}

export function getTerminalCommandParameters(
  command: TerminalSpawnCommand
): TerminalCommandParameters {
  return command.parameters ?? fieldsToTerminalCommandParameters(command.fields)
}

export function getTerminalCommandDefaultValues(
  command: TerminalSpawnCommand,
  presetValues: TerminalCommandFieldValues = {}
): TerminalCommandFieldValues {
  const values: TerminalCommandFieldValues = {}
  const parameters = getTerminalCommandParameters(command)
  for (const [fieldId, property] of Object.entries(parameters.schema.properties)) {
    const preset = presetValues[fieldId]
    if (typeof preset === 'string' || typeof preset === 'boolean') {
      values[fieldId] = preset
      continue
    }
    const defaultValue = getJsonSchemaDefaultValue(property)
    if (defaultValue !== undefined) {
      values[fieldId] = defaultValue
      continue
    }
    values[fieldId] = getJsonSchemaPropertyType(property) === 'boolean' ? false : ''
  }
  return values
}

function stringifyFieldValue(value: TerminalCommandFieldValue | undefined): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return value ?? ''
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getJsonSchemaDefaultValue(property: unknown): TerminalCommandFieldValue | undefined {
  if (!isRecord(property)) return undefined
  const defaultValue = property.default
  if (typeof defaultValue === 'string' || typeof defaultValue === 'boolean') return defaultValue
  return undefined
}

function getJsonSchemaPropertyType(property: unknown): string | undefined {
  if (!isRecord(property)) return undefined
  return typeof property.type === 'string' ? property.type : undefined
}

export function renderTerminalCommandArgs(
  command: TerminalSpawnCommand,
  values: TerminalCommandFieldValues
): string[] {
  const args: string[] = []
  for (const arg of command.args) {
    if (arg.kind === 'literal') {
      args.push(arg.value)
      continue
    }
    if (arg.kind === 'booleanFlag') {
      if (values[arg.fieldId] === true) {
        args.push(arg.flag)
      }
      continue
    }
    const value = stringifyFieldValue(values[arg.fieldId]).trim()
    if (!value && arg.omitWhenEmpty) continue
    args.push(`${arg.prefix}${value}`)
  }
  return args
}

function renderTerminalCommandBuilderParts(
  parts: readonly TerminalCommandBuilderPart[],
  values: TerminalCommandFieldValues
): string[] {
  const argv: string[] = []
  for (const part of parts) {
    if (part.kind === 'literal') {
      if (part.value.trim().length > 0) {
        argv.push(part.value)
      }
      continue
    }
    if (part.kind === 'booleanFlag') {
      if (values[part.fieldId] === true) {
        argv.push(part.flag)
      }
      continue
    }
    const value = stringifyFieldValue(values[part.fieldId]).trim()
    if (!value && part.omitWhenEmpty) continue
    argv.push(`${part.prefix}${value}`)
  }
  return argv
}

function renderTemplateString(template: string, values: TerminalCommandFieldValues): string {
  return template.replace(/\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}/g, (_match, fieldId: string) =>
    stringifyFieldValue(values[fieldId])
  )
}

export function renderTerminalSpawnCommand(options: {
  command: TerminalSpawnCommand
  values: TerminalCommandFieldValues
}): TerminalCommandRenderResult {
  const builder = options.command.builder
  if (!builder) {
    return {
      kind: 'argv',
      argv: [
        options.command.command,
        ...renderTerminalCommandArgs(options.command, options.values),
      ],
    }
  }
  if (builder.kind === 'shellLine') {
    return {
      kind: 'shellLine',
      commandLine: renderTemplateString(builder.template, options.values).trim(),
    }
  }
  return {
    kind: 'argv',
    argv: renderTerminalCommandBuilderParts(builder.parts, options.values),
  }
}

function quotePosix(value: string): string {
  if (value.length === 0) return "''"
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function quoteCmd(value: string): string {
  if (value.length === 0) return '""'
  if (!/[\s"&|<>^()%!]/.test(value)) return value
  return `"${value.replace(/(["^&|<>])/g, '^$1')}"`
}

function quotePowerShell(value: string): string {
  if (value.length === 0) return "''"
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value
  return `'${value.replace(/'/g, "''")}'`
}

export function quoteTerminalShellArg(value: string, quoteStyle: TerminalShellQuoteStyle): string {
  if (quoteStyle === 'cmd') return quoteCmd(value)
  if (quoteStyle === 'powershell') return quotePowerShell(value)
  return quotePosix(value)
}

export function renderTerminalSpawnCommandLine(options: {
  command: TerminalSpawnCommand
  values: TerminalCommandFieldValues
  quoteStyle: TerminalShellQuoteStyle
}): string {
  const result = renderTerminalSpawnCommand(options)
  if (result.kind === 'shellLine') return result.commandLine
  return result.argv.map((part) => quoteTerminalShellArg(part, options.quoteStyle)).join(' ')
}
