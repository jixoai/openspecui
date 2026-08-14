#!/usr/bin/env tsx
/**
 * Orthogonal intents (updated 2026-08-04 Asia/Shanghai):
 * 1. Check every changed supported text file with the repository formatter.
 * 2. Invoke pnpm without asking Node to execute a Windows command shim directly.
 * 3. Bound formatter argv batches so large Windows worktrees do not exceed the
 *    command-line length limit.
 * 4. Hide subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make equivalent package scripts work on Windows."
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'
import { splitArgumentsByLength } from './lib/argument-batches'
import { resolvePnpmInvocation } from './lib/pnpm-invocation.mjs'

const SUPPORTED_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.cts',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.mjs',
  '.mts',
  '.scss',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
])

function gitOutput(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) {
    const stderr = result.stderr.trim()
    throw new Error(stderr || `git ${args.join(' ')} failed with code ${result.status ?? 1}`)
  }
  return result.stdout.trim()
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function hasSupportedExtension(file: string): boolean {
  const dotIndex = file.lastIndexOf('.')
  if (dotIndex < 0) return false
  return SUPPORTED_EXTENSIONS.has(file.slice(dotIndex))
}

// `pnpm exec` may still cross an npm-style `.cmd` boundary internally on Windows,
// whose practical command-line limit is lower than CreateProcess' native limit.
const FORMATTER_ARGV_LIMIT = 4_000

function getChangedFiles(): string[] {
  const baseSha = process.env.FORMAT_CHECK_BASE_SHA?.trim()
  if (baseSha) {
    return gitOutput(['diff', '--name-only', '--diff-filter=ACMR', `${baseSha}...HEAD`])
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
  }

  const tracked = gitOutput(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const untracked = gitOutput(['ls-files', '--others', '--exclude-standard'])
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return unique([...tracked, ...untracked])
}

function main(): number {
  const changedFiles = getChangedFiles()
    .filter((file) => existsSync(file))
    .filter(hasSupportedExtension)

  if (changedFiles.length === 0) {
    console.log('[format:check] No changed files require Prettier check.')
    return 0
  }

  console.log(`[format:check] Checking ${changedFiles.length} changed file(s).`)
  const fixedArgs = ['exec', 'prettier', '--check']
  const invocation = resolvePnpmInvocation(fixedArgs)
  const batches = splitArgumentsByLength(
    invocation.command,
    fixedArgs,
    changedFiles,
    FORMATTER_ARGV_LIMIT
  )
  console.log(`[format:check] Running ${batches.length} formatter batch(es).`)

  for (const [index, files] of batches.entries()) {
    const result = spawnSync(invocation.command, [...invocation.args, ...files], {
      stdio: 'inherit',
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      windowsHide: true,
    })
    if (result.error) throw result.error
    if ((result.status ?? 1) !== 0) return result.status ?? 1
    console.log(
      `[format:check] Batch ${index + 1}/${batches.length} passed (${files.length} file(s)).`
    )
  }

  return 0
}

process.exit(main())
