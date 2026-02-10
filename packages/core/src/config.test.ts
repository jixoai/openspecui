import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ConfigManager, DEFAULT_CONFIG, OpenSpecUIConfigSchema } from './config.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers, initWatcherPool } from './reactive-fs/watcher-pool.js'
import {
  createTempDir,
  createTempFile,
  createTempSubDir,
  cleanupTempDir,
  waitForDebounce,
} from './__tests__/test-utils.js'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { ReactiveContext } from './reactive-fs/reactive-context.js'

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
        cli: { command: 'bunx openspec' },
        ui: { theme: 'dark' as const },
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(customConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.cli.command).toBe('bunx openspec')
      expect(config.ui.theme).toBe('dark')
    })

    it('should return default config for invalid JSON', async () => {
      await writeFile(join(tempDir, 'openspec', '.openspecui.json'), 'invalid json', 'utf-8')

      const config = await configManager.readConfig()

      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('should return default config for invalid schema', async () => {
      const invalidConfig = {
        cli: { command: 123 }, // should be string
        ui: { theme: 'invalid' }, // should be light/dark/system
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
        // ui is missing
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(partialConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.cli.command).toBe('custom')
      expect(config.ui.theme).toBe('system') // default
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
      await configManager.writeConfig({ ui: { theme: 'dark' } })
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('initial') // 保留
      expect(config.ui.theme).toBe('dark') // 更新
    })

    it('should create file if not exists', async () => {
      await configManager.writeConfig({ cli: { command: 'new' } })

      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('new')
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
      await configManager.writeConfig({ cli: { command: 'bunx openspec' } })
      clearCache()

      const command = await configManager.getCliCommand()

      expect(command).toEqual(['bunx', 'openspec'])
    })
  })

  describe('setCliCommand()', () => {
    it('should set CLI command', async () => {
      await configManager.setCliCommand('custom command')
      clearCache()

      const command = await configManager.getCliCommand()
      expect(command).toEqual(['custom', 'command'])
    })

    it('should preserve other config', async () => {
      await configManager.writeConfig({ ui: { theme: 'dark' } })
      clearCache()
      await configManager.setCliCommand('new command')
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('new command')
      expect(config.ui.theme).toBe('dark')
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
        JSON.stringify({ cli: { command: 'updated' }, ui: { theme: 'system' } }),
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
      ui: { theme: 'dark' },
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
      expect(result.data.ui.theme).toBe('system')
    }
  })

  it('should reject invalid theme', () => {
    const config = {
      ui: { theme: 'invalid' },
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(false)
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
    expect(DEFAULT_CONFIG.ui.theme).toBe('system')
  })
})
