/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove standard Windows package-manager and Node CLI shims preserve argv without cmd.exe text assembly.
 * 2. Prove a Bun-hosted resolver selects a real Node executable in a `.cmd`-only installation.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 * 4. Compare Bun-owned node boundaries through canonical paths because hosted runners mix 8.3
 *    short forms (RUNNER~1) with long forms in TEMP-derived fixture roots.
 * 5. Prove modern (`%dp0%`) npm shim extraction mirrors the packages/core hardening on all platforms.
 *
 * Original request (2026-08-28, issue #258): "No available OpenSpec CLI runner." on Windows with an
 *   in-range global npm CLI installed through modern npm `cmd-shim` output.
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { resolveWindowsCommandInvocation } from './lib/command-invocation.mjs'
import {
  extractNodeCommandShimEntryTokens,
  resolveNodeCommandShimEntry,
} from './lib/package-manager-shim.mjs'

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
  return spawnSync('where.exe', [command], { encoding: 'utf8', windowsHide: true })
    .stdout.split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
}

function canonicalWindowsPath(value) {
  try {
    return realpathSync.native(value).toLowerCase()
  } catch {
    return value.toLowerCase()
  }
}

/** Byte-accurate modern `cmd-shim` (npm ≥7) final-call source for a relative entry. */
function modernNpmCommandShimSource(relativeEntry) {
  return [
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    'IF EXIST "%dp0%\\node.exe" (',
    '  SET "_prog=%dp0%\\node.exe"',
    ') ELSE (',
    '  SET "_prog=node"',
    '  SET PATHEXT=%PATHEXT:;.JS;=;%',
    ')',
    `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% | "%_prog%"  "%dp0%\\${relativeEntry}" %*`,
    '',
  ].join('\r\n')
}

describe('npm command shim entry extraction (mirror of packages/core)', () => {
  it('extracts modern and legacy dp0 entry tokens', () => {
    expect(
      extractNodeCommandShimEntryTokens(
        modernNpmCommandShimSource('node_modules\\@fission-ai\\openspec\\bin\\openspec.js')
      )
    ).toEqual(['node_modules\\@fission-ai\\openspec\\bin\\openspec.js'])
    expect(
      extractNodeCommandShimEntryTokens('"%~dp0\\node_modules\\npm\\bin\\npm-cli.js" %*\r\n')
    ).toEqual(['node_modules\\npm\\bin\\npm-cli.js'])
  })

  it('resolves a modern shim onto its contained entry and rejects escapes', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'openspecui-shim-mirror-'))
    try {
      // Global-prefix layout: the shim sits beside its node_modules directory.
      const prefixShim = join(fixtureRoot, 'openspec.cmd')
      const entry = join(
        fixtureRoot,
        'node_modules',
        '@fission-ai',
        'openspec',
        'bin',
        'openspec.js'
      )
      // Local .bin layout: the shim resolves its entry through a ..-relative reference.
      const binShim = join(fixtureRoot, 'node_modules', '.bin', 'openspec.cmd')
      // `..\evil.js` from tool/ points at a real file inside the shim's parent; only the
      // containment rule (not existence) may reject it.
      const toolShim = join(fixtureRoot, 'tool', 'tool.cmd')
      const escaped = join(fixtureRoot, 'evil.js')
      mkdirSync(dirname(binShim), { recursive: true })
      mkdirSync(dirname(entry), { recursive: true })
      mkdirSync(dirname(toolShim), { recursive: true })
      writeFileSync(prefixShim, '')
      writeFileSync(binShim, '')
      writeFileSync(toolShim, '')
      writeFileSync(entry, '')
      writeFileSync(escaped, '')

      const prefixSource = modernNpmCommandShimSource(
        'node_modules\\@fission-ai\\openspec\\bin\\openspec.js'
      )
      const binSource = modernNpmCommandShimSource('..\\@fission-ai\\openspec\\bin\\openspec.js')
      expect(resolveNodeCommandShimEntry(prefixShim, prefixSource)).toBe(realpathSync.native(entry))
      expect(resolveNodeCommandShimEntry(binShim, binSource)).toBe(realpathSync.native(entry))
      expect(
        resolveNodeCommandShimEntry(toolShim, modernNpmCommandShimSource('..\\evil.js'))
      ).toBeNull()
      expect(resolveNodeCommandShimEntry(toolShim, '"%dp0%\\C:\\evil.js" %*\r\n')).toBeNull()
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })
})

describe.runIf(process.platform === 'win32')('Windows package-manager command shims', () => {
  it('resolves a modern npm cmd-shim and preserves arbitrary argv without cmd.exe', () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), 'openspecui-modern-npm-shim-'))
    try {
      const commandShim = join(fixtureRoot, 'openspec.cmd')
      const entry = join(
        fixtureRoot,
        'node_modules',
        '@fission-ai',
        'openspec',
        'bin',
        'openspec.js'
      )
      mkdirSync(dirname(entry), { recursive: true })
      writeFileSync(
        commandShim,
        modernNpmCommandShimSource('node_modules\\@fission-ai\\openspec\\bin\\openspec.js')
      )
      writeFileSync(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')

      const invocation = resolveWindowsCommandInvocation('openspec', SPECIAL_ARGUMENTS, [
        commandShim,
      ])
      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        windowsHide: true,
      })

      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(SPECIAL_ARGUMENTS)
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

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
      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        windowsHide: true,
      })

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
      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        windowsHide: true,
      })

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
        windowsHide: true,
      })

      expect(bunResult.status, bunResult.stderr).toBe(0)
      const evidence = JSON.parse(bunResult.stdout)
      expect(canonicalWindowsPath(evidence.invocation.command)).toBe(
        canonicalWindowsPath(nodeExecutable)
      )
      expect(canonicalWindowsPath(evidence.invocation.command)).not.toBe(
        canonicalWindowsPath(bunExecutable)
      )
      expect(evidence.exitCode, evidence.stderr).toBe(0)
      const observed = JSON.parse(evidence.stdout)
      expect(canonicalWindowsPath(observed.execPath)).toBe(canonicalWindowsPath(nodeExecutable))
      expect(observed.args).toEqual(SPECIAL_ARGUMENTS)
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  }, 20_000)
})
