/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Prove standard Windows package-manager and Node CLI shims preserve argv without cmd.exe text assembly.
 * 2. Prove a Bun-hosted resolver selects a real Node executable in a `.cmd`-only installation.
 *
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { resolveWindowsCommandInvocation } from './lib/command-invocation.mjs'

const SPECIAL_ARGUMENTS = [
  '',
  'space separated',
  'a&b',
  '%PATH%',
  'a^b',
  'a"b',
  'C:\\space path\\',
  '(x)|y<z>',
]

function where(command) {
  return spawnSync('where.exe', [command], { encoding: 'utf8' })
    .stdout.split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
}

describe.runIf(process.platform === 'win32')('Windows package-manager command shims', () => {
  it('resolves a standard npm-style Node CLI shim and preserves arbitrary argv', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'openspecui-node-cli-shim-'))
    try {
      const commandShim = join(fixtureRoot, 'openspec.cmd')
      const entry = join(fixtureRoot, 'node_modules', 'openspec', 'bin', 'openspec.js')
      mkdirSync(dirname(entry), { recursive: true })
      writeFileSync(
        commandShim,
        '@ECHO off\r\n"%~dp0\\node.exe" "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*\r\n'
      )
      writeFileSync(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')

      const invocation = resolveWindowsCommandInvocation('openspec', SPECIAL_ARGUMENTS, [
        commandShim,
      ])
      const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' })

      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(SPECIAL_ARGUMENTS)
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it('resolves an npm-style shim to its JavaScript entry and preserves argv', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'openspecui-npm-shim-'))
    try {
      const commandShim = join(fixtureRoot, 'npm.cmd')
      const entry = join(fixtureRoot, 'node_modules', 'npm', 'bin', 'npm-cli.js')
      mkdirSync(dirname(entry), { recursive: true })
      writeFileSync(
        commandShim,
        '@ECHO off\r\n"%~dp0\\node.exe" "%~dp0\\node_modules\\npm\\bin\\npm-cli.js" %*\r\n'
      )
      writeFileSync(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')

      const invocation = resolveWindowsCommandInvocation('npm', SPECIAL_ARGUMENTS, [commandShim])
      const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' })

      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(SPECIAL_ARGUMENTS)
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it('routes shell-sensitive pnpm argv through Corepack without reinterpretation', () => {
    const invocation = resolveWindowsCommandInvocation(
      'pnpm',
      ['exec', 'node', '-p', 'JSON.stringify(process.argv.slice(1))', '--', ...SPECIAL_ARGUMENTS],
      where('pnpm'),
      where('corepack')
    )
    const result = spawnSync(invocation.command, invocation.args, { encoding: 'utf8' })

    expect(result.status, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual(SPECIAL_ARGUMENTS)
  }, 30_000)

  it('bypasses an npm executable forwarder when argv requires an exact boundary', () => {
    const invocation = resolveWindowsCommandInvocation('npm', SPECIAL_ARGUMENTS, where('npm'))

    expect(invocation.command).toBe(process.execPath)
    expect(invocation.args[0]).toMatch(/[\\/]npm[\\/]bin[\\/]npm-cli\.js$/i)
    expect(invocation.args.slice(1)).toEqual(SPECIAL_ARGUMENTS)
  })

  it('uses node.exe instead of bun.exe for a cmd-only pnpm installation', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'openspecui-bun-node-owner-'))
    try {
      const nodeExecutable = join(fixtureRoot, 'node.exe')
      const commandShim = join(fixtureRoot, 'pnpm.cmd')
      const entry = join(fixtureRoot, 'pnpm.mjs')
      copyFileSync(process.execPath, nodeExecutable)
      writeFileSync(commandShim, '@ECHO off\r\n"%~dp0\\node.exe" "%~dp0\\pnpm.mjs" %*\r\n')
      writeFileSync(
        entry,
        'process.stdout.write(JSON.stringify({ execPath: process.execPath, args: process.argv.slice(2) }))\n'
      )

      const bunExecutable = where('bun').find((candidate) => candidate.endsWith('.exe'))
      expect(bunExecutable).toBeDefined()
      if (!bunExecutable) return
      const systemRoot = process.env.SystemRoot ?? 'C:\\Windows'
      const childEnv = {
        ...process.env,
        Path: [fixtureRoot, join(systemRoot, 'System32'), dirname(process.execPath)].join(';'),
      }
      delete childEnv.PATH
      const source = [
        `import { resolveCommandInvocation } from ${JSON.stringify(new URL('./lib/command-invocation.mjs', import.meta.url).href)}`,
        `const invocation = resolveCommandInvocation('pnpm', ${JSON.stringify(SPECIAL_ARGUMENTS)})`,
        "const child = Bun.spawnSync({ cmd: [invocation.command, ...invocation.args], stdout: 'pipe', stderr: 'pipe' })",
        'const decode = (bytes) => new TextDecoder().decode(bytes)',
        'process.stdout.write(JSON.stringify({ invocation, exitCode: child.exitCode, stdout: decode(child.stdout), stderr: decode(child.stderr) }))',
      ].join(';')
      const bunResult = spawnSync(bunExecutable, ['-e', source], {
        encoding: 'utf8',
        env: childEnv,
      })

      expect(bunResult.status, bunResult.stderr).toBe(0)
      const evidence = JSON.parse(bunResult.stdout)
      expect(evidence.invocation.command.toLowerCase()).toBe(nodeExecutable.toLowerCase())
      expect(evidence.invocation.command.toLowerCase()).not.toBe(bunExecutable.toLowerCase())
      expect(evidence.exitCode, evidence.stderr).toBe(0)
      expect(JSON.parse(evidence.stdout)).toEqual({
        execPath: nodeExecutable,
        args: SPECIAL_ARGUMENTS,
      })
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  }, 20_000)
})
