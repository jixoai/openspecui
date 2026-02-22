import type {
  ACPProviderConfig,
  AIProvider,
  CompletionOptions,
  CompletionResponse,
} from './types.js'

/**
 * ACP-based AI provider (Agent Client Protocol)
 * Communicates with coding agents via standardized protocol
 *
 * Note: ACP support is experimental and not yet fully implemented.
 * The ACP SDK API is still evolving.
 *
 * @see https://agentclientprotocol.com/
 */
export class ACPProvider implements AIProvider {
  readonly name: string
  readonly type = 'acp' as const

  constructor(private config: ACPProviderConfig) {
    this.name = config.name
  }

  async complete(_options: CompletionOptions): Promise<CompletionResponse> {
    // TODO: Implement ACP protocol communication
    // The ACP SDK requires:
    // 1. Spawning the agent process
    // 2. Creating Web Streams from Node.js streams
    // 3. Establishing ClientSideConnection
    // 4. Initializing session with cwd
    // 5. Sending prompts via promptTurn
    throw new Error(
      `ACP provider "${this.name}" is not yet implemented. ` +
        `Command: ${this.config.command} ${this.config.args.join(' ')}`
    )
  }

  async isAvailable(): Promise<boolean> {
    // ACP providers require the agent binary to be installed
    // For now, return false as the implementation is incomplete
    return false
  }

  async dispose(): Promise<void> {
    // No resources to clean up in stub implementation
  }
}

/**
 * Predefined ACP agent configurations
 *
 * Native ACP support:
 * - iFlow: `iflow --experimental-acp`
 * - Gemini: `gemini --experimental-acp`
 *
 * ACP adapters (by Zed team):
 * - Claude Code: https://github.com/zed-industries/claude-code-acp
 * - Codex: https://github.com/zed-industries/codex-acp
 */
export const ACPAgents = {
  /** iFlow - native ACP support */
  iflow: {
    type: 'acp' as const,
    name: 'iFlow',
    command: 'iflow',
    args: ['--experimental-acp'],
  },
  /** Gemini - native ACP support */
  gemini: {
    type: 'acp' as const,
    name: 'Gemini',
    command: 'gemini',
    args: ['--experimental-acp'],
  },
  /** Claude Code via Zed's ACP adapter */
  claude: {
    type: 'acp' as const,
    name: 'Claude Code',
    command: 'claude-code-acp',
    args: [],
  },
  /** OpenAI Codex via Zed's ACP adapter */
  codex: {
    type: 'acp' as const,
    name: 'Codex',
    command: 'codex-acp',
    args: [],
  },
} satisfies Record<string, ACPProviderConfig>
