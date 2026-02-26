import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import { CliExecutor, type CliResult } from './cli-executor.js'
import { ConfigManager } from './config.js'
import { clearCache } from './reactive-fs/index.js'
import { closeAllWatchers } from './reactive-fs/watcher-pool.js'

describe('CliExecutor', () => {
  let tempDir: string
  let configManager: ConfigManager
  let cliExecutor: CliExecutor

  beforeEach(async () => {
    tempDir = await createTempDir()
    await mkdir(join(tempDir, 'openspec'), { recursive: true })
    configManager = new ConfigManager(tempDir)
    cliExecutor = new CliExecutor(configManager, tempDir)
    clearCache()
  })

  afterEach(async () => {
    clearCache()
    closeAllWatchers()
    await cleanupTempDir(tempDir)
  })

  describe('execute()', () => {
    it('should execute command and return result', async () => {
      // 使用 echo 命令测试基本执行
      await configManager.writeConfig({ cli: { command: 'echo' } })
      clearCache()

      const result = await cliExecutor.execute(['hello', 'world'])

      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('hello world')
      expect(result.exitCode).toBe(0)
    })

    it('should handle command with multiple parts', async () => {
      // 测试带参数的命令
      await configManager.writeConfig({ cli: { command: 'echo test' } })
      clearCache()

      const result = await cliExecutor.execute(['arg1'])

      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe('test arg1')
    })

    it('should capture stderr', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute(['-e', "process.stderr.write('error')"])

      expect(result.stderr.trim()).toBe('error')
    })

    it('should return failure for non-zero exit code', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute(['-e', 'process.exit(1)'])

      expect(result.success).toBe(false)
      expect(result.exitCode).toBe(1)
    })

    it('should handle command not found', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()

      const result = await cliExecutor.execute(['arg'])

      expect(result.success).toBe(false)
    })

    it('should use project directory as cwd', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute(['-e', 'process.stdout.write(process.cwd())'])

      expect(result.success).toBe(true)
      // macOS 上 /var 是 /private/var 的符号链接
      const normalizedOutput = result.stdout.trim().replace('/private', '')
      const normalizedTempDir = tempDir.replace('/private', '')
      expect(normalizedOutput).toBe(normalizedTempDir)
    })
  })

  describe('init()', () => {
    it('should call execute with init args and no tools (auto-detect)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init()

      expect(executeSpy).toHaveBeenCalledWith(['init'])
    })

    it('should call execute with specific tools', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ tools: ['claude', 'cursor'] })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--tools', 'claude,cursor'])
    })

    it('should call execute with tools=none', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ tools: 'none' })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--tools', 'none'])
    })

    it('should call execute with profile override', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ profile: 'core' })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--profile', 'core'])
    })

    it('should call execute with force flag', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Initialized',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.init({ force: true })

      expect(executeSpy).toHaveBeenCalledWith(['init', '--force'])
    })
  })

  describe('archive()', () => {
    it('should call execute with archive args and -y flag', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Archived',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.archive('change-123')

      expect(executeSpy).toHaveBeenCalledWith(['archive', '-y', 'change-123'])
    })

    it('should include --skip-specs when option is set', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Archived',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.archive('change-123', { skipSpecs: true })

      expect(executeSpy).toHaveBeenCalledWith(['archive', '-y', 'change-123', '--skip-specs'])
    })

    it('should include --no-validate when option is set', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Archived',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.archive('change-123', { noValidate: true })

      expect(executeSpy).toHaveBeenCalledWith(['archive', '-y', 'change-123', '--no-validate'])
    })
  })

  describe('validate()', () => {
    it('should call execute with validate args (no params)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Valid',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.validate()

      expect(executeSpy).toHaveBeenCalledWith(['validate'])
    })

    it('should call execute with validate args (type only)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Valid',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.validate('spec')

      expect(executeSpy).toHaveBeenCalledWith(['validate', 'spec'])
    })

    it('should call execute with validate args (type and id)', async () => {
      const executeSpy = vi.spyOn(cliExecutor, 'execute').mockResolvedValue({
        success: true,
        stdout: 'Valid',
        stderr: '',
        exitCode: 0,
      })

      await cliExecutor.validate('change', 'change-123')

      expect(executeSpy).toHaveBeenCalledWith(['validate', 'change', 'change-123'])
    })
  })

  describe('checkAvailability()', () => {
    it('should return available when command succeeds', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.checkAvailability()

      expect(result.available).toBe(true)
      expect(result.version).toBeDefined()
      expect(result.effectiveCommand).toBe('node')
    })

    it('should return not available when runner resolve fails', async () => {
      vi.spyOn(configManager, 'getResolvedCliRunner').mockRejectedValue(new Error('resolve failed'))
      const result = await cliExecutor.checkAvailability()
      expect(result.available).toBe(false)
      expect(result.error).toBe('resolve failed')
    })

    it('should report unavailable for invalid configured execute path', async () => {
      await configManager.writeConfig({ cli: { command: 'nonexistent_command_12345' } })
      clearCache()
      const result = await cliExecutor.checkAvailability()
      expect(result.available).toBe(false)
      expect(result.error).toContain('nonexistent_command_12345')
    })
  })

  describe('integration with real CLI', () => {
    // 这些测试使用真实的 CLI 命令
    // 根据用户要求：在临时文件中使用真实的 CLI

    it('should execute echo command', async () => {
      await configManager.writeConfig({ cli: { command: 'echo' } })
      clearCache()

      const result = await cliExecutor.execute(['test', 'message'])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('test message')
    })

    it('should execute command in project directory', async () => {
      // 创建一些文件
      await writeFile(join(tempDir, 'file1.txt'), 'content')
      await writeFile(join(tempDir, 'file2.txt'), 'content')

      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute([
        '-e',
        "const fs=require('fs');process.stdout.write(fs.readdirSync('.').join('\\n'))",
      ])

      expect(result.success).toBe(true)
      expect(result.stdout).toContain('file1.txt')
      expect(result.stdout).toContain('file2.txt')
    })

    it('should handle command with environment variables', async () => {
      await configManager.writeConfig({ cli: { command: 'node' } })
      clearCache()

      const result = await cliExecutor.execute([
        '-e',
        "process.stdout.write(process.env.HOME || '')",
      ])

      expect(result.success).toBe(true)
      expect(result.stdout.trim()).toBe(process.env.HOME)
    })
  })
})

describe('CliResult', () => {
  it('should have correct structure', () => {
    const result: CliResult = {
      success: true,
      stdout: 'output',
      stderr: '',
      exitCode: 0,
    }

    expect(result).toHaveProperty('success')
    expect(result).toHaveProperty('stdout')
    expect(result).toHaveProperty('stderr')
    expect(result).toHaveProperty('exitCode')
  })
})
