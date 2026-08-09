/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Prove export subprocesses execute a cmd-only npm-style launcher with exact Windows argv.
 *
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { runExportSubprocess } from './export-subprocess.js'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true, maxRetries: 5 }))
  )
})

describe.runIf(process.platform === 'win32')('Windows export subprocess invocation', () => {
  it('preserves shell-sensitive argv through a cmd-only pnpm installation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'openspecui-export-subprocess-'))
    tempDirs.push(root)
    const command = join(root, 'pnpm.cmd')
    const nodeExecutable = join(root, 'node.exe')
    const entry = join(root, 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
    const output = join(root, 'path with spaces', 'argv.json')
    const args = ['', 'space separated', 'a&b', '%PATH%', '^caret', 'quote"x', 'C:\\tail\\']

    await mkdir(dirname(entry), { recursive: true })
    await mkdir(dirname(output), { recursive: true })
    await copyFile(process.execPath, nodeExecutable)
    await writeFile(
      command,
      ['@ECHO off', '"%~dp0\\node.exe" "%~dp0\\node_modules\\pnpm\\bin\\pnpm.cjs" %*', ''].join(
        '\r\n'
      )
    )
    await writeFile(
      entry,
      [
        "const { writeFileSync } = require('node:fs')",
        'const [output, ...args] = process.argv.slice(2)',
        'writeFileSync(output, JSON.stringify(args))',
        '',
      ].join('\n')
    )

    await runExportSubprocess({
      command: 'pnpm',
      args: [output, ...args],
      cwd: root,
      env: { ...process.env, PATH: root, PATHEXT: '.EXE;.CMD' },
    })

    await expect(readFile(output, 'utf8')).resolves.toBe(JSON.stringify(args))
  })
})
