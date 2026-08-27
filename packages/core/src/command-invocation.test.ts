/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Prove Windows command resolution consumes the caller's PATH and prefers native executable boundaries.
 * 2. Prove shell-sensitive pnpm uses Corepack or a cmd-only Node entry while opaque shims are rejected.
 * 3. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 * 4. Prove modern (`%dp0%`) and legacy (`%~dp0`) npm command-shim entry extraction with hardened
 *    containment that still admits the standard `node_modules/.bin/..` layout.
 *
 * Original request (2026-08-28, issue #258): "No available OpenSpec CLI runner." on Windows with a
 *   correctly installed in-range global npm CLI.
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { link, mkdir, symlink, writeFile } from 'node:fs/promises'
import { delimiter, dirname, join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { cleanupTempDir, createTempDir } from './__tests__/test-utils.js'
import {
  extractNodeCommandShimEntryTokens,
  resolveNodeCommandShimEntry,
  resolveWindowsCommandInvocation,
} from './command-invocation.js'

function commandPathEnv(root: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: root,
    PATHEXT: '.EXE;.CMD',
  }
}

async function writeNodeCommandShim(root: string, name: string): Promise<string> {
  const command = join(root, `${name}.cmd`)
  const entry = join(root, 'node_modules', name, 'bin', `${name}.mjs`)
  await mkdir(dirname(entry), { recursive: true })
  await writeFile(
    command,
    [
      '@ECHO off',
      `IF EXIST "%~dp0\\node.exe" (`,
      `  "%~dp0\\node.exe" "%~dp0\\node_modules\\${name}\\bin\\${name}.mjs" %*`,
      ') ELSE (',
      `  node "%~dp0\\node_modules\\${name}\\bin\\${name}.mjs" %*`,
      ')',
      '',
    ].join('\r\n')
  )
  await writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
  return entry
}

/** Byte-accurate modern `cmd-shim` (npm ≥7) output for a global-prefix Node command. */
function modernNpmCommandShimSource(relativeEntry: string): string {
  return [
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    '',
    'IF EXIST "%dp0%\\node.exe" (',
    '  SET "_prog=%dp0%\\node.exe"',
    ') ELSE (',
    '  SET "_prog=node"',
    '  SET PATHEXT=%PATHEXT:;.JS;=;%',
    ')',
    '',
    'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% | "%_prog%"  "%dp0%\\' +
      relativeEntry +
      '" %*',
    '',
  ].join('\r\n')
}

const MODERN_GLOBAL_ENTRY = 'node_modules\\@fission-ai\\openspec\\bin\\openspec.js'

describe('npm command shim entry extraction', () => {
  it('extracts the JavaScript entry from a modern cmd-shim final call', () => {
    expect(
      extractNodeCommandShimEntryTokens(modernNpmCommandShimSource(MODERN_GLOBAL_ENTRY))
    ).toEqual(['node_modules\\@fission-ai\\openspec\\bin\\openspec.js'])
  })

  it('extracts the entry from a legacy %~dp0 shim', () => {
    const source = [
      '@ECHO off',
      `IF EXIST "%~dp0\\node.exe" (`,
      `  "%~dp0\\node.exe" "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*`,
      ') ELSE (',
      `  node "%~dp0\\node_modules\\openspec\\bin\\openspec.js" %*`,
      ')',
      '',
    ].join('\r\n')
    expect(extractNodeCommandShimEntryTokens(source)).toEqual([
      'node_modules\\openspec\\bin\\openspec.js',
      'node_modules\\openspec\\bin\\openspec.js',
    ])
  })

  it('extracts .cjs and .mjs entries', () => {
    expect(extractNodeCommandShimEntryTokens('"%dp0%\\bin\\tool.cjs" %*\r\n')).toEqual([
      'bin\\tool.cjs',
    ])
    expect(extractNodeCommandShimEntryTokens('node "%~dp0x\\y.mjs" %*\r\n')).toEqual(['x\\y.mjs'])
  })

  it('ignores dp0 references that do not name a JavaScript entry', () => {
    const source = modernNpmCommandShimSource(MODERN_GLOBAL_ENTRY).replace(
      MODERN_GLOBAL_ENTRY,
      'node_modules\\@fission-ai\\openspec\\bin\\openspec.exe'
    )
    expect(extractNodeCommandShimEntryTokens(source)).toEqual([])
    expect(extractNodeCommandShimEntryTokens('@ECHO off\r\nSET dp0=%~dp0\r\n')).toEqual([])
  })
})

describe('npm command shim entry resolution', () => {
  it('resolves a modern global-prefix shim onto its real entry file', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'openspec.cmd')
      const entry = join(root, 'node_modules', '@fission-ai', 'openspec', 'bin', 'openspec.js')
      await mkdir(dirname(entry), { recursive: true })
      await writeFile(entry, '')
      await writeFile(command, modernNpmCommandShimSource(MODERN_GLOBAL_ENTRY))

      expect(
        resolveNodeCommandShimEntry(command, modernNpmCommandShimSource(MODERN_GLOBAL_ENTRY))
      ).toBe(realpathSync.native(entry))
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('resolves a node_modules/.bin shim through its ..-relative entry', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'node_modules', '.bin', 'openspec.cmd')
      const entry = join(root, 'node_modules', '@fission-ai', 'openspec', 'bin', 'openspec.js')
      await mkdir(dirname(command), { recursive: true })
      await mkdir(dirname(entry), { recursive: true })
      await writeFile(entry, '')
      const source = modernNpmCommandShimSource('..\\@fission-ai\\openspec\\bin\\openspec.js')
      await writeFile(command, source)

      expect(resolveNodeCommandShimEntry(command, source)).toBe(realpathSync.native(entry))
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('rejects entries that escape the shim directory without a .bin layout', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'tool', 'tool.cmd')
      // `..\evil.js` from the shim directory resolves to a real file inside the shim's parent;
      // only the .bin-scoped containment rule (not existence) may reject it.
      const escaped = join(root, 'evil.js')
      await mkdir(dirname(command), { recursive: true })
      await writeFile(escaped, '')
      const source = modernNpmCommandShimSource('..\\evil.js')
      await writeFile(command, source)

      expect(resolveNodeCommandShimEntry(command, source)).toBeNull()
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('rejects drive-letter, UNC, NUL, and unexpanded-variable tokens', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'tool.cmd')
      // A UNC-shaped token must stay rejected even when a matching local file exists: without
      // the raw-prefix check, stripping the leading separators degrades `\\server\share\evil.js`
      // into the local relative path `server\share\evil.js`.
      const uncLocalTarget = join(root, 'server', 'share', 'evil.js')
      await mkdir(dirname(uncLocalTarget), { recursive: true })
      await writeFile(uncLocalTarget, '')
      await writeFile(command, '')

      expect(extractNodeCommandShimEntryTokens('"%dp0%\\\\server\\share\\evil.js" %*\r\n')).toEqual(
        []
      )
      expect(
        resolveNodeCommandShimEntry(command, '"%dp0%\\\\server\\share\\evil.js" %*\r\n')
      ).toBeNull()
      for (const token of ['C:\\evil.js', 'a\0b.js', '%dp0%\\x.js']) {
        expect(resolveNodeCommandShimEntry(command, `"%dp0%\\${token}" %*\r\n`), token).toBeNull()
      }
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('rejects missing files and directory entries', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'tool.cmd')
      const directory = join(root, 'pkg')
      await mkdir(directory)
      await writeFile(command, '')

      expect(resolveNodeCommandShimEntry(command, '"%dp0%\\missing.js" %*\r\n')).toBeNull()
      expect(resolveNodeCommandShimEntry(command, '"%dp0%\\pkg" %*\r\n')).toBeNull()
    } finally {
      await cleanupTempDir(root)
    }
  })

  it.skipIf(process.platform === 'win32')(
    'rejects a symlinked entry pointing outside the shim roots',
    async () => {
      const root = await createTempDir()
      try {
        const outside = await createTempDir()
        const command = join(root, 'tool.cmd')
        const linkPath = join(root, 'linked-entry.js')
        await mkdir(dirname(command), { recursive: true })
        await writeFile(join(outside, 'target.js'), '')
        await symlink(join(outside, 'target.js'), linkPath)
        await writeFile(command, '')

        try {
          expect(resolveNodeCommandShimEntry(command, '"%dp0%\\linked-entry.js" %*\r\n')).toBeNull()
        } finally {
          await cleanupTempDir(outside)
        }
      } finally {
        await cleanupTempDir(root)
      }
    }
  )
})

describe.runIf(process.platform === 'win32')('Windows command invocation', () => {
  it('prefers a native executable discovered from the caller PATH', async () => {
    const root = await createTempDir()
    try {
      const executable = join(root, 'fixture.exe')
      await link(process.execPath, executable)
      await writeFile(join(root, 'fixture.cmd'), '@ECHO off\r\nexit /b 7\r\n')

      expect(
        resolveWindowsCommandInvocation('fixture', ['a&b'], {
          cwd: root,
          env: commandPathEnv(root),
        })
      ).toEqual({ command: executable, args: ['a&b'] })
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('routes shell-sensitive pnpm argv through Corepack from the caller PATH', async () => {
    const root = await createTempDir()
    try {
      const corepack = join(root, 'corepack.exe')
      await link(process.execPath, corepack)
      await writeFile(join(root, 'pnpm.cmd'), '@ECHO off\r\nexit /b 7\r\n')

      expect(
        resolveWindowsCommandInvocation('pnpm', ['exec', 'fixture', 'a&b'], {
          cwd: root,
          env: commandPathEnv(root),
        })
      ).toEqual({ command: corepack, args: ['pnpm', 'exec', 'fixture', 'a&b'] })
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('uses a pnpm Node shim when the caller PATH has no native pnpm or Corepack executable', async () => {
    const root = await createTempDir()
    try {
      const entry = await writeNodeCommandShim(root, 'pnpm')
      const args = ['exec', 'fixture', 'a&b', '%PATH%', 'C:\\space path\\']
      const env = {
        ...commandPathEnv(root),
        PATH: [root, dirname(process.execPath)].join(delimiter),
      }
      const invocation = resolveWindowsCommandInvocation('pnpm', args, { cwd: root, env })
      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        env,
        windowsHide: true,
      })

      expect(invocation.args[0]).toBe(realpathSync.native(entry))
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(args)
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('resolves a modern npm cmd-shim from the caller PATH without cmd.exe', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'openspec.cmd')
      const entry = join(root, 'node_modules', '@fission-ai', 'openspec', 'bin', 'openspec.js')
      await mkdir(dirname(entry), { recursive: true })
      await writeFile(entry, 'process.stdout.write(JSON.stringify(process.argv.slice(2)))\n')
      const args = ['--version', 'a&b']
      const env = {
        ...commandPathEnv(root),
        PATH: [root, dirname(process.execPath)].join(delimiter),
      }
      await writeFile(command, modernNpmCommandShimSource(MODERN_GLOBAL_ENTRY))

      const invocation = resolveWindowsCommandInvocation('openspec', args, { cwd: root, env })
      expect(invocation.command, JSON.stringify(invocation)).toBe(process.execPath)
      expect(invocation.args[0]).toBe(realpathSync.native(entry))
      expect(invocation.args.slice(1)).toEqual(args)

      const result = spawnSync(invocation.command, invocation.args, {
        encoding: 'utf8',
        env,
        windowsHide: true,
      })
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual(args)
    } finally {
      await cleanupTempDir(root)
    }
  })

  it('rejects an opaque explicit command shim', async () => {
    const root = await createTempDir()
    try {
      const command = join(root, 'opaque.cmd')
      await writeFile(command, '@ECHO off\r\necho %*\r\n')

      expect(() =>
        resolveWindowsCommandInvocation(command, ['a&b'], {
          cwd: root,
          env: commandPathEnv(root),
        })
      ).toThrow(/opaque Windows command shim/)
    } finally {
      await cleanupTempDir(root)
    }
  })
})
