#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

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
  const result = spawnSync('git', args, { encoding: 'utf8' })
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
  const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(pnpmCmd, ['exec', 'prettier', '--check', ...changedFiles], {
    stdio: 'inherit',
  })
  return result.status ?? 1
}

process.exit(main())
