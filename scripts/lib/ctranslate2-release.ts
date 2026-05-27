#!/usr/bin/env node
import { appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readNapiArtifactPlan, verifyNapiPublishArtifacts } from './publish-packages/napi-artifacts'

type Ct2ReleaseTarget = {
  artifactFileName: string
  artifactName: string
  packageDir: string
  platformArchAbi: string
  runner: string
  target: string
}

const RUNNER_BY_TARGET: Record<string, string> = {
  'aarch64-apple-darwin': 'macos-14',
  // GitHub-hosted Intel macOS runners now use the explicit `macos-15-intel`
  // label for public repositories; the old `macos-13` label can sit queued
  // indefinitely and blocks the aggregated native publish job.
  'x86_64-apple-darwin': 'macos-15-intel',
  'x86_64-pc-windows-msvc': 'windows-2022',
  'x86_64-unknown-linux-gnu': 'ubuntu-24.04',
}

const DEFAULT_ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function getCt2PackageDir(rootDir: string = DEFAULT_ROOT_DIR): string {
  return join(rootDir, 'packages', 'ct2-engine')
}

export function getCt2ReleaseTargets(rootDir: string = DEFAULT_ROOT_DIR): Ct2ReleaseTarget[] {
  const packageDir = getCt2PackageDir(rootDir)
  const plan = readNapiArtifactPlan(packageDir)
  if (!plan) {
    throw new Error(`No NAPI artifact plan found for ${packageDir}`)
  }

  return plan.entries.map((entry) => {
    const runner = RUNNER_BY_TARGET[entry.target]
    if (!runner) {
      throw new Error(`No GitHub Actions runner is configured for ${entry.target}`)
    }
    return {
      artifactFileName: entry.artifactFileName,
      artifactName: `ctranslate2-${entry.platformArchAbi}`,
      packageDir,
      platformArchAbi: entry.platformArchAbi,
      runner,
      target: entry.target,
    }
  })
}

export function verifyCt2ReleaseTargets(rootDir: string = DEFAULT_ROOT_DIR): void {
  verifyNapiPublishArtifacts(getCt2PackageDir(rootDir))
}

function writeGithubOutput(path: string, rootDir: string): void {
  const targets = getCt2ReleaseTargets(rootDir)
  const matrix = JSON.stringify(targets)
  appendFileSync(path, `matrix=${matrix}\n`)
  appendFileSync(path, `count=${targets.length}\n`)
}

function getArgValue(args: string[], flag: string): string | null {
  const index = args.indexOf(flag)
  if (index < 0) return null
  return args[index + 1] ?? null
}

function main(): void {
  const [, , command = 'matrix', ...args] = process.argv
  const rootDir = DEFAULT_ROOT_DIR

  if (command === 'matrix') {
    const githubOutput = getArgValue(args, '--github-output')
    if (githubOutput) {
      writeGithubOutput(githubOutput, rootDir)
      return
    }
    process.stdout.write(`${JSON.stringify(getCt2ReleaseTargets(rootDir), null, 2)}\n`)
    return
  }

  if (command === 'verify') {
    verifyCt2ReleaseTargets(rootDir)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
