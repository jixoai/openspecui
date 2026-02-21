import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir, waitForDebounce } from './__tests__/test-utils.js'
import {
  ConfigManager,
  DEFAULT_CONFIG,
  OpenSpecUIConfigSchema,
  buildCliRunnerCandidates,
} from './config.js'
import { clearCache } from './reactive-fs/index.js'
import { ReactiveContext } from './reactive-fs/reactive-context.js'
import { closeAllWatchers, initWatcherPool } from './reactive-fs/watcher-pool.js'

describe('ConfigManager', () => {
  let tempDir: string
  let configManager: ConfigManager

  beforeEach(async () => {
    tempDir = await createTempDir()
    // 创建 openspec 目录
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    configManager = new ConfigManager(tempDir)
    await initWatcherPool(tempDir)
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('readConfig()', () => {
    it('should return default config when file does not exist', async () => {
      const config = await configManager.readConfig()

      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('should read config from file', async () => {
      const customConfig = {
        cli: { command: 'bunx', args: ['openspec'] },
        theme: 'dark' as const,
        terminal: {
          fontSize: 14,
          fontFamily: 'JetBrains Mono',
          cursorBlink: true,
          cursorStyle: 'block' as const,
          scrollback: 2000,
          rendererEngine: 'ghostty' as const,
        },
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(customConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.cli.command).toBe('bunx')
      expect(config.cli.args).toEqual(['openspec'])
      expect(config.theme).toBe('dark')
      expect(config.terminal.fontSize).toBe(14)
      expect(config.terminal.rendererEngine).toBe('ghostty')
    })

    it('should return default config for invalid JSON', async () => {
      await writeFile(join(tempDir, 'openspec', '.openspecui.json'), 'invalid json', 'utf-8')

      const config = await configManager.readConfig()

      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('should return default config for invalid schema', async () => {
      const invalidConfig = {
        cli: { command: 123 }, // should be string
        theme: 'invalid', // should be light/dark/system
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(invalidConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('should merge partial config with defaults', async () => {
      const partialConfig = {
        cli: { command: 'custom' },
        // theme / terminal missing
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(partialConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.cli.command).toBe('custom')
      expect(config.theme).toBe('system') // default
      expect(config.terminal.scrollback).toBe(1000)
      expect(config.terminal.rendererEngine).toBe('xterm')
    })
  })

  describe('writeConfig()', () => {
    it('should write config to file', async () => {
      await configManager.writeConfig({ cli: { command: 'custom' } })

      // 清除缓存以获取最新值
      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('custom')
    })

    it('should merge with existing config', async () => {
      // 先写入初始配置
      await configManager.writeConfig({ cli: { command: 'initial' } })
      clearCache()

      // 再写入部分配置
      await configManager.writeConfig({ theme: 'dark' })
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('initial') // 保留
      expect(config.theme).toBe('dark') // 更新
    })

    it('should create file if not exists', async () => {
      await configManager.writeConfig({ cli: { command: 'new' } })

      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('new')
    })

    it('should create openspec directory if missing before write', async () => {
      await rm(join(tempDir, 'openspec'), { recursive: true, force: true })
      clearCache()

      await configManager.writeConfig({ cli: { command: 'openspec' } })
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('openspec')
    })
  })

  describe('getCliCommand()', () => {
    it('should return default command', async () => {
      const command = await configManager.getCliCommand()

      expect(Array.isArray(command)).toBe(true)
      expect(command.length).toBeGreaterThan(0)
      command.forEach((item) => expect(typeof item).toBe('string'))
    })

    it('should return custom command', async () => {
      await configManager.writeConfig({ cli: { command: 'bunx', args: ['openspec'] } })
      clearCache()

      const command = await configManager.getCliCommand()

      expect(command).toEqual(['bunx', 'openspec'])
    })

    it('should not fallback when configured command is invalid', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()
      await expect(configManager.getCliCommand()).rejects.toThrow(
        'No available OpenSpec CLI runner'
      )
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('nonexistent_command_12345')
      expect(config.cli.args).toBeUndefined()
    })
  })

  describe('setCliCommand()', () => {
    it('should set CLI command', async () => {
      await configManager.setCliCommand('node --version')
      clearCache()

      const command = await configManager.getCliCommand()
      expect(command).toEqual(['node', '--version'])
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('node')
      expect(config.cli.args).toEqual(['--version'])
    })

    it('should expose updated CLI command immediately after save', async () => {
      await configManager.setCliCommand('qaq zz')
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('qaq')
      expect(config.cli.args).toEqual(['zz'])
    })

    it('should preserve other config', async () => {
      await configManager.writeConfig({ theme: 'dark' })
      clearCache()
      await configManager.setCliCommand('new command')
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('new')
      expect(config.cli.args).toEqual(['command'])
      expect(config.theme).toBe('dark')
    })

    it('should clear CLI command when empty string is provided', async () => {
      await configManager.setCliCommand('custom command --flag')
      clearCache()
      await configManager.setCliCommand('')
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBeUndefined()
      expect(config.cli.args).toBeUndefined()
    })

    it('should parse quoted execute path into command and args', async () => {
      await configManager.setCliCommand(
        '"C:/Program Files/PowerShell/7/pwsh.exe" -File "D:/a b/c.ps1"'
      )
      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('C:/Program Files/PowerShell/7/pwsh.exe')
      expect(config.cli.args).toEqual(['-File', 'D:/a b/c.ps1'])
    })

    it('should preserve windows path separators when parsing command and args', async () => {
      await configManager.setCliCommand(
        '"C:\\Program Files\\PowerShell\\7\\pwsh.exe" -File "D:\\a b\\c.ps1"'
      )
      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('C:\\Program Files\\PowerShell\\7\\pwsh.exe')
      expect(config.cli.args).toEqual(['-File', 'D:\\a b\\c.ps1'])
    })

    it('should unwrap whole-command quotes when arguments are provided', async () => {
      await configManager.setCliCommand('"pwsh -File \\"D:\\\\a b\\\\openspec.ps1\\" -NoProfile"')
      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('pwsh')
      expect(config.cli.args).toEqual(['-File', 'D:\\a b\\openspec.ps1', '-NoProfile'])
    })
  })

  describe('reactive updates', () => {
    it('should update when config file changes', async () => {
      const context = new ReactiveContext()

      const generator = context.stream(async () => configManager.readConfig())

      // 获取初始值
      const first = await generator.next()
      expect(first.value.cli.command).toBeUndefined()

      // 直接修改配置文件
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify({ cli: { command: 'updated' }, theme: 'system' }),
        'utf-8'
      )
      await waitForDebounce(200)

      // 获取更新后的值
      const second = await generator.next()
      expect(second.value.cli.command).toBe('updated')

      await generator.return(undefined)
    }, 10000)
  })
})

describe('OpenSpecUIConfigSchema', () => {
  it('should validate valid config', () => {
    const config = {
      cli: { command: 'npx @fission-ai/openspec' },
      theme: 'dark',
      terminal: {
        fontSize: 13,
        fontFamily: '',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        rendererEngine: 'xterm',
      },
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(true)
  })

  it('should apply defaults for missing fields', () => {
    const config = {}

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cli.command).toBeUndefined()
      expect(result.data.theme).toBe('system')
      expect(result.data.terminal.fontSize).toBe(13)
      expect(result.data.terminal.rendererEngine).toBe('xterm')
    }
  })

  it('should reject invalid theme', () => {
    const config = {
      theme: 'invalid',
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(false)
  })

  it('should preserve invalid rendererEngine value from config file', () => {
    const config = {
      terminal: {
        rendererEngine: 'yx',
      },
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.terminal.rendererEngine).toBe('yx')
    }
  })

  it('should accept all valid themes', () => {
    for (const theme of ['light', 'dark', 'system']) {
      const config = { ui: { theme } }
      const result = OpenSpecUIConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    }
  })
})

describe('DEFAULT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONFIG.cli.command).toBeUndefined()
    expect(DEFAULT_CONFIG.theme).toBe('system')
    expect(DEFAULT_CONFIG.terminal.scrollback).toBe(1000)
    expect(DEFAULT_CONFIG.terminal.rendererEngine).toBe('xterm')
  })
})

describe('buildCliRunnerCandidates', () => {
  it('should include configured command first', () => {
    const candidates = buildCliRunnerCandidates({
      configuredCommandParts: ['bunx', '@fission-ai/openspec'],
      userAgent: 'npm/10.0.0 node/v20',
    })
    expect(candidates[0]?.source).toBe('config.cli.command')
    expect(candidates[1]?.source).toBe('openspec')
  })

  it('should prioritize bunx when user agent is bun', () => {
    const candidates = buildCliRunnerCandidates({ userAgent: 'bun/1.2.0' })
    const sources = candidates.map((candidate) => candidate.source)
    expect(sources).toEqual(['openspec', 'bunx', 'npx', 'deno', 'pnpm', 'yarn'])
  })
})
