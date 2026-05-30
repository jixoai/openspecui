import { chmod, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { DEFAULT_BELL_SOUND_ID, DEFAULT_NOTIFICATION_SOUND_ID } from './sounds.js'

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
    await closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('readConfig()', () => {
    it('should return default config when file does not exist', async () => {
      const config = await configManager.readConfig()

      expect(config).toEqual(DEFAULT_CONFIG)
    })

    it('reports project translation engine field presence separately from defaults', async () => {
      await expect(configManager.readConfigPresence()).resolves.toEqual({
        translation: {
          enabled: false,
          targetLanguage: false,
          displayMode: false,
          cacheEnabled: false,
          engineId: false,
          engines: {
            local: false,
            localCt2: false,
            localLlama: false,
            openai: false,
          },
        },
      })

      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify({
          translation: {
            engineId: 'local-llama',
            engines: {
              localLlama: {
                selectedGroupId: 'q4',
              },
            },
          },
        }),
        'utf-8'
      )
      clearCache()

      await expect(configManager.readConfigPresence()).resolves.toEqual({
        translation: {
          enabled: false,
          targetLanguage: false,
          displayMode: false,
          cacheEnabled: false,
          engineId: true,
          engines: {
            local: false,
            localCt2: false,
            localLlama: true,
            openai: false,
          },
        },
      })
    })

    it('should read config from file', async () => {
      const customConfig = {
        cli: { command: 'bunx', args: ['openspec'] },
        theme: 'dark' as const,
        appBaseUrl: 'https://app.example.com/openspecui',
        opsx: {
          agentInvocationMode: 'command' as const,
        },
        terminal: {
          fontSize: 14,
          fontFamily: 'JetBrains Mono',
          cursorBlink: true,
          cursorStyle: 'block' as const,
          scrollback: 2000,
          useTheme: 'system' as const,
          lightTheme: 'solarized-light' as const,
          darkTheme: 'monokai' as const,
          rendererEngine: 'ghostty' as const,
          bellSound: 'builtin:Glass' as const,
          bellVolume: 0.4,
        },
        notifications: {
          sound: 'builtin:Tink' as const,
          volume: 0.35,
          systemNotificationsEnabled: true,
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
      expect(config.appBaseUrl).toBe('https://app.example.com/openspecui')
      expect(config.opsx.agentInvocationMode).toBe('command')
      expect(config.terminal.fontSize).toBe(14)
      expect(config.terminal.useTheme).toBe('system')
      expect(config.terminal.lightTheme).toBe('solarized-light')
      expect(config.terminal.darkTheme).toBe('monokai')
      expect(config.terminal.rendererEngine).toBe('ghostty')
      expect(config.terminal.bellSound).toBe('builtin:Glass')
      expect(config.terminal.bellVolume).toBe(0.4)
      expect(config.notifications.sound).toBe('builtin:Tink')
      expect(config.notifications.volume).toBe(0.35)
      expect(config.notifications.systemNotificationsEnabled).toBe(true)
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

    it('should repair invalid enum fields to defaults without dropping valid siblings', async () => {
      const persistedConfig = {
        cli: { command: 'bunx', args: ['openspec'] },
        theme: 'nope',
        codeEditor: { theme: 'broken' },
        opsx: { agentInvocationMode: 'auto' },
        terminal: {
          cursorStyle: 'beam',
          useTheme: 'twilight',
          lightTheme: 'dracula',
          darkTheme: 'ayu',
          rendererEngine: 'yx',
          bellSound: 'builtin:Missing',
          scrollback: 2048,
        },
        notifications: {
          sound: 'builtin:Missing',
          volume: 0.35,
          systemNotificationsEnabled: true,
        },
        translation: {
          enabled: true,
          displayMode: 'triple',
          engineId: 'nmt',
          targetLanguage: 'fr',
          cacheEnabled: true,
          engines: {
            local: { model: 'onnx-community/opus-mt-en-fr', selectedGroupId: 'int8' },
            openai: { model: 'gpt-4.1-mini' },
          },
        },
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(persistedConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.cli.command).toBe('bunx')
      expect(config.cli.args).toEqual(['openspec'])
      expect(config.theme).toBe(DEFAULT_CONFIG.theme)
      expect(config.codeEditor.theme).toBe(DEFAULT_CONFIG.codeEditor.theme)
      expect(config.opsx.agentInvocationMode).toBe(DEFAULT_CONFIG.opsx.agentInvocationMode)
      expect(config.terminal.cursorStyle).toBe(DEFAULT_CONFIG.terminal.cursorStyle)
      expect(config.terminal.useTheme).toBe(DEFAULT_CONFIG.terminal.useTheme)
      expect(config.terminal.lightTheme).toBe(DEFAULT_CONFIG.terminal.lightTheme)
      expect(config.terminal.darkTheme).toBe(DEFAULT_CONFIG.terminal.darkTheme)
      expect(config.terminal.rendererEngine).toBe(DEFAULT_CONFIG.terminal.rendererEngine)
      expect(config.terminal.bellSound).toBe(DEFAULT_CONFIG.terminal.bellSound)
      expect(config.terminal.scrollback).toBe(2048)
      expect(config.notifications.sound).toBe(DEFAULT_CONFIG.notifications.sound)
      expect(config.notifications.volume).toBe(0.35)
      expect(config.notifications.systemNotificationsEnabled).toBe(true)
      expect(config.translation.enabled).toBe(true)
      expect(config.translation.targetLanguage).toBe('fr')
      expect(config.translation.cacheEnabled).toBe(true)
      expect(config.translation.displayMode).toBe(DEFAULT_CONFIG.translation.displayMode)
      expect(config.translation.engineId).toBe(DEFAULT_CONFIG.translation.engineId)
      expect(config.translation.engines.local).toEqual({
        model: 'onnx-community/opus-mt-en-fr',
        selectedGroupId: 'int8',
      })
      expect(config.translation.engines.openai).toEqual({ model: 'gpt-4.1-mini' })
    })

    it('should repair invalid nested persisted object nodes before schema parsing', async () => {
      const persistedConfig = {
        theme: 'dark',
        codeEditor: 'github',
        opsx: 'compose',
        terminal: 'xterm',
        notifications: [],
        translation: {
          enabled: true,
          engines: 'broken',
        },
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(persistedConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.theme).toBe('dark')
      expect(config.codeEditor).toEqual(DEFAULT_CONFIG.codeEditor)
      expect(config.opsx).toEqual(DEFAULT_CONFIG.opsx)
      expect(config.terminal).toEqual(DEFAULT_CONFIG.terminal)
      expect(config.notifications).toEqual(DEFAULT_CONFIG.notifications)
      expect(config.translation.enabled).toBe(true)
      expect(config.translation.engines).toEqual(DEFAULT_CONFIG.translation.engines)
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
      expect(config.codeEditor.theme).toBe('github')
      expect(config.appBaseUrl).toBe('')
      expect(config.opsx.agentInvocationMode).toBe('compose')
      expect(config.terminal.scrollback).toBe(1000)
      expect(config.terminal.useTheme).toBe('app')
      expect(config.terminal.lightTheme).toBe('default-light')
      expect(config.terminal.darkTheme).toBe('default-dark')
      expect(config.terminal.rendererEngine).toBe('xterm')
      expect(config.terminal.bellSound).toBe(DEFAULT_BELL_SOUND_ID)
      expect(config.terminal.bellVolume).toBe(1)
      expect(config.dashboard.trendPointLimit).toBe(100)
      expect(config.git.diffEagerLineBudget).toBe(1000)
      expect(config.notifications.sound).toBe(DEFAULT_NOTIFICATION_SOUND_ID)
      expect(config.notifications.volume).toBe(1)
      expect(config.notifications.systemNotificationsEnabled).toBe(false)
      expect(config.translation).toEqual({
        enabled: false,
        targetLanguage: 'zh',
        displayMode: 'direct',
        cacheEnabled: false,
        engineId: 'browser',
        engines: { local: {}, localCt2: {}, localLlama: {}, openai: {} },
      })
    })

    it('should treat persisted null fields as absent and keep valid sibling overrides', async () => {
      const partialConfig = {
        theme: null,
        dashboard: {
          trendPointLimit: 180,
        },
      }
      await writeFile(
        join(tempDir, 'openspec', '.openspecui.json'),
        JSON.stringify(partialConfig),
        'utf-8'
      )

      const config = await configManager.readConfig()

      expect(config.theme).toBe('system')
      expect(config.dashboard.trendPointLimit).toBe(180)
    })
  })

  describe('writeConfig()', () => {
    it('should write config to file', async () => {
      await configManager.writeConfig({ cli: { command: 'custom' } })

      // 清除缓存以获取最新值
      clearCache()
      const config = await configManager.readConfig()
      expect(config.cli.command).toBe('custom')
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "cli": {\n    "command": "custom"\n  }\n}'
      )
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

    it('should write dashboard config', async () => {
      await configManager.writeConfig({ dashboard: { trendPointLimit: 180 } })
      clearCache()
      const config = await configManager.readConfig()
      expect(config.dashboard.trendPointLimit).toBe(180)
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "dashboard": {\n    "trendPointLimit": 180\n  }\n}'
      )
    })

    it('should write git config', async () => {
      await configManager.writeConfig({ git: { diffEagerLineBudget: 1500 } })
      clearCache()
      const config = await configManager.readConfig()
      expect(config.git.diffEagerLineBudget).toBe(1500)
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "git": {\n    "diffEagerLineBudget": 1500\n  }\n}'
      )
    })

    it('should write opsx config', async () => {
      await configManager.writeConfig({ opsx: { agentInvocationMode: 'command' } })
      clearCache()
      const config = await configManager.readConfig()
      expect(config.opsx.agentInvocationMode).toBe('command')
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "opsx": {\n    "agentInvocationMode": "command"\n  }\n}'
      )
    })

    it('should write terminal bell sound config', async () => {
      await configManager.writeConfig({ terminal: { bellSound: 'silent', bellVolume: 0.25 } })
      clearCache()
      const config = await configManager.readConfig()
      expect(config.terminal.bellSound).toBe('silent')
      expect(config.terminal.bellVolume).toBe(0.25)
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "terminal": {\n    "bellSound": "silent",\n    "bellVolume": 0.25\n  }\n}'
      )
    })

    it('should write notification config', async () => {
      await configManager.writeConfig({
        notifications: { sound: 'builtin:Glass', volume: 0.6, systemNotificationsEnabled: true },
      })
      clearCache()
      const config = await configManager.readConfig()
      expect(config.notifications.sound).toBe('builtin:Glass')
      expect(config.notifications.volume).toBe(0.6)
      expect(config.notifications.systemNotificationsEnabled).toBe(true)
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "notifications": {\n    "sound": "builtin:Glass",\n    "volume": 0.6,\n    "systemNotificationsEnabled": true\n  }\n}'
      )
    })

    it('should write and prune translation config', async () => {
      await configManager.writeConfig({
        translation: {
          enabled: true,
          targetLanguage: 'zh',
          displayMode: 'bilingual',
          cacheEnabled: true,
        },
      })
      clearCache()

      let config = await configManager.readConfig()
      expect(config.translation).toEqual({
        enabled: true,
        targetLanguage: 'zh',
        displayMode: 'bilingual',
        cacheEnabled: true,
        engineId: 'browser',
        engines: { local: {}, localCt2: {}, localLlama: {}, openai: {} },
      })
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "translation": {\n    "enabled": true,\n    "displayMode": "bilingual",\n    "cacheEnabled": true\n  }\n}'
      )

      await configManager.writeConfig({
        translation: { enabled: false, displayMode: 'direct', cacheEnabled: false },
      })
      clearCache()

      config = await configManager.readConfig()
      expect(config.translation).toEqual(DEFAULT_CONFIG.translation)
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{}'
      )
    })

    it('should merge per-engine translation model patches without overwriting siblings', async () => {
      await configManager.writeConfig({
        translation: { engines: { openai: { model: 'gpt-4.1-mini' } } },
      })
      clearCache()

      await configManager.writeConfig({
        translation: { engines: { local: { model: 'Xenova/custom-nmt' } } },
      })
      clearCache()

      const config = await configManager.readConfig()
      expect(config.translation.engines).toEqual({
        openai: { model: 'gpt-4.1-mini' },
        local: { model: 'Xenova/custom-nmt' },
        localCt2: {},
        localLlama: {},
      })
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "translation": {\n    "engines": {\n      "local": {\n        "model": "Xenova/custom-nmt"\n      },\n      "openai": {\n        "model": "gpt-4.1-mini"\n      }\n    }\n  }\n}'
      )
    })

    it('should clear per-engine translation fields when a patch sets them to null', async () => {
      await configManager.writeConfig({
        translation: {
          engines: {
            local: { model: 'onnx-community/opus-mt-en-zh', selectedGroupId: 'q8' },
          },
        },
      })
      clearCache()

      await configManager.writeConfig({
        translation: {
          engines: {
            local: { selectedGroupId: null },
          },
        },
      })
      clearCache()

      const config = await configManager.readConfig()
      expect(config.translation.engines.local).toEqual({
        model: 'onnx-community/opus-mt-en-zh',
      })
      await expect(readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')).resolves.toBe(
        '{\n  "translation": {\n    "engines": {\n      "local": {\n        "model": "onnx-community/opus-mt-en-zh"\n      }\n    }\n  }\n}'
      )
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

    it('should not create a config file when writing only default values', async () => {
      await configManager.writeConfig({
        theme: 'system',
        codeEditor: { theme: 'github' },
        appBaseUrl: '',
        opsx: { agentInvocationMode: 'compose' },
        terminal: {
          fontSize: 13,
          fontFamily: '',
          cursorBlink: true,
          cursorStyle: 'block',
          scrollback: 1000,
          useTheme: 'app',
          lightTheme: 'default-light',
          darkTheme: 'default-dark',
          rendererEngine: 'xterm',
          bellSound: DEFAULT_BELL_SOUND_ID,
          bellVolume: 1,
        },
        dashboard: { trendPointLimit: 100 },
        git: { diffEagerLineBudget: 1000 },
        notifications: {
          sound: DEFAULT_NOTIFICATION_SOUND_ID,
          volume: 1,
          systemNotificationsEnabled: false,
        },
      })

      await expect(
        readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')
      ).rejects.toThrow()
    })

    it('should preserve an existing config file as {} when values are reset to defaults', async () => {
      await configManager.writeConfig({ theme: 'dark' })
      clearCache()

      await configManager.writeConfig({ theme: 'system' })
      clearCache()

      const content = await readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')
      const config = await configManager.readConfig()

      expect(content).toBe('{}')
      expect(config.theme).toBe('system')
    })

    it('should prune opsx config when reset to default', async () => {
      await configManager.writeConfig({ opsx: { agentInvocationMode: 'command' } })
      clearCache()

      await configManager.writeConfig({ opsx: { agentInvocationMode: 'compose' } })
      clearCache()

      const content = await readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')
      const config = await configManager.readConfig()

      expect(content).toBe('{}')
      expect(config.opsx.agentInvocationMode).toBe('compose')
    })
  })

  describe('getCliCommand()', () => {
    it('should return default command', async () => {
      const command = await configManager.getCliCommand()

      expect(Array.isArray(command)).toBe(true)
      expect(command.length).toBeGreaterThan(0)
      command.forEach((item) => expect(typeof item).toBe('string'))
      await expect(
        readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')
      ).rejects.toThrow()
    }, 25000)

    it('should return custom command', async () => {
      await configManager.writeConfig({ cli: { command: process.execPath, args: ['--version'] } })
      clearCache()

      const command = await configManager.getCliCommand()

      expect(command).toEqual([process.execPath, '--version'])
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

    it('should surface synchronous spawn errors without arming the probe timeout', async () => {
      const invalidCommand = 'node\u0000broken'
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      await configManager.writeConfig({ cli: { command: invalidCommand } })
      clearCache()

      try {
        await expect(configManager.getCliCommand()).rejects.toThrow('without null bytes')
        const probeTimerCall = setTimeoutSpy.mock.calls.find((call) => call[1] === 20_000)
        expect(probeTimerCall).toBeUndefined()
      } finally {
        setTimeoutSpy.mockRestore()
      }
    })

    it('should resolve openspec via shell lookup when PATH misses the shim directory', async () => {
      const fakeCliPath = join(tempDir, 'openspec-cli')
      const fakeShellPath = join(tempDir, 'lookup-shell.sh')

      await writeFile(
        fakeCliPath,
        '#!/bin/sh\nif [ "$1" = "--version" ]; then\n  echo "1.2.0"\n  exit 0\nfi\nexit 1\n',
        'utf8'
      )
      await writeFile(
        fakeShellPath,
        `#!/bin/sh\nif [ "$1" = "-lc" ]; then\n  printf '%s\\n' '${fakeCliPath}'\n  exit 0\nfi\nexit 1\n`,
        'utf8'
      )
      await Promise.all([chmod(fakeCliPath, 0o755), chmod(fakeShellPath, 0o755)])

      const previousPath = process.env.PATH
      const previousShell = process.env.SHELL

      process.env.PATH = '/usr/bin:/bin'
      process.env.SHELL = fakeShellPath

      try {
        const command = await configManager.getCliCommand()
        expect(command).toEqual([fakeCliPath])
      } finally {
        process.env.PATH = previousPath
        process.env.SHELL = previousShell
      }
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

    it('should avoid persisting an explicit execute path that matches the default runner', async () => {
      const defaultCommand = await configManager.getCliCommand()

      await configManager.setCliCommand(defaultCommand.join(' '))
      clearCache()

      const config = await configManager.readConfig()
      expect(config.cli.command).toBeUndefined()
      await expect(
        readFile(join(tempDir, 'openspec', '.openspecui.json'), 'utf-8')
      ).rejects.toThrow()
    }, 25000)

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
      codeEditor: { theme: 'github' },
      appBaseUrl: 'https://app.example.com/ui',
      opsx: {
        agentInvocationMode: 'command',
      },
      terminal: {
        fontSize: 13,
        fontFamily: '',
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 1000,
        useTheme: 'app',
        lightTheme: 'default-light',
        darkTheme: 'default-dark',
        rendererEngine: 'xterm',
        bellSound: DEFAULT_BELL_SOUND_ID,
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
      expect(result.data.codeEditor.theme).toBe('github')
      expect(result.data.appBaseUrl).toBe('')
      expect(result.data.opsx.agentInvocationMode).toBe('compose')
      expect(result.data.terminal.fontSize).toBe(13)
      expect(result.data.terminal.useTheme).toBe('app')
      expect(result.data.terminal.lightTheme).toBe('default-light')
      expect(result.data.terminal.darkTheme).toBe('default-dark')
      expect(result.data.terminal.rendererEngine).toBe('xterm')
      expect(result.data.terminal.bellSound).toBe(DEFAULT_BELL_SOUND_ID)
      expect(result.data.git.diffEagerLineBudget).toBe(1000)
      expect(result.data.translation.enabled).toBe(false)
      expect(result.data.translation.targetLanguage).toBe('zh')
      expect(result.data.translation.displayMode).toBe('direct')
      expect(result.data.translation.engineId).toBe('browser')
      expect(result.data.translation.engines).toEqual({
        local: {},
        localCt2: {},
        localLlama: {},
        openai: {},
      })
    }
  })

  it('should reject invalid theme', () => {
    const config = {
      theme: 'invalid',
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(false)
  })

  it('should reject invalid opsx invocation mode', () => {
    const config = {
      opsx: {
        agentInvocationMode: 'auto',
      },
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(false)
  })

  it('should reject invalid rendererEngine', () => {
    const config = {
      terminal: {
        rendererEngine: 'yx',
      },
    }

    const result = OpenSpecUIConfigSchema.safeParse(config)

    expect(result.success).toBe(false)
  })

  it('should accept all valid themes', () => {
    for (const theme of ['light', 'dark', 'system']) {
      const config = { theme }
      const result = OpenSpecUIConfigSchema.safeParse(config)
      expect(result.success).toBe(true)
    }
  })

  it('should accept all valid code editor themes', () => {
    for (const theme of ['github', 'material', 'vscode', 'tokyo', 'gruvbox', 'monokai', 'nord']) {
      const result = OpenSpecUIConfigSchema.safeParse({ codeEditor: { theme } })
      expect(result.success).toBe(true)
    }
  })

  it('should accept all valid terminal theme modes', () => {
    for (const useTheme of ['app', 'light', 'dark', 'system']) {
      const result = OpenSpecUIConfigSchema.safeParse({ terminal: { useTheme } })
      expect(result.success).toBe(true)
    }
  })

  it('should accept all valid terminal themes', () => {
    for (const theme of [
      'default-light',
      'default-dark',
      'monokai',
      'nord',
      'solarized-light',
      'solarized-dark',
    ]) {
      const result = OpenSpecUIConfigSchema.safeParse({
        terminal: { lightTheme: theme, darkTheme: theme },
      })
      expect(result.success).toBe(true)
    }
  })
})

describe('DEFAULT_CONFIG', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_CONFIG.cli.command).toBeUndefined()
    expect(DEFAULT_CONFIG.theme).toBe('system')
    expect(DEFAULT_CONFIG.codeEditor.theme).toBe('github')
    expect(DEFAULT_CONFIG.appBaseUrl).toBe('')
    expect(DEFAULT_CONFIG.opsx.agentInvocationMode).toBe('compose')
    expect(DEFAULT_CONFIG.terminal.scrollback).toBe(1000)
    expect(DEFAULT_CONFIG.terminal.useTheme).toBe('app')
    expect(DEFAULT_CONFIG.terminal.lightTheme).toBe('default-light')
    expect(DEFAULT_CONFIG.terminal.darkTheme).toBe('default-dark')
    expect(DEFAULT_CONFIG.terminal.rendererEngine).toBe('xterm')
    expect(DEFAULT_CONFIG.terminal.bellSound).toBe(DEFAULT_BELL_SOUND_ID)
    expect(DEFAULT_CONFIG.terminal.bellVolume).toBe(1)
    expect(DEFAULT_CONFIG.dashboard.trendPointLimit).toBe(100)
    expect(DEFAULT_CONFIG.git.diffEagerLineBudget).toBe(1000)
    expect(DEFAULT_CONFIG.notifications.sound).toBe(DEFAULT_NOTIFICATION_SOUND_ID)
    expect(DEFAULT_CONFIG.notifications.volume).toBe(1)
    expect(DEFAULT_CONFIG.translation.enabled).toBe(false)
    expect(DEFAULT_CONFIG.translation.targetLanguage).toBe('zh')
    expect(DEFAULT_CONFIG.translation.displayMode).toBe('direct')
    expect(DEFAULT_CONFIG.translation.cacheEnabled).toBe(false)
    expect(DEFAULT_CONFIG.translation.engineId).toBe('browser')
    expect(DEFAULT_CONFIG.translation.engines).toEqual({
      local: {},
      localCt2: {},
      localLlama: {},
      openai: {},
    })
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
