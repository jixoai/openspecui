import { createCleanCliEnv } from '@openspecui/core'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface RuntimeHostPackageContext {
  packageDir: string
  packageJsonPath: string
  packageName: '@openspecui/server' | 'openspecui'
}

interface RuntimeHostPackageJson {
  name?: unknown
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

export interface RuntimePackageDependencyTreeNode {
  name?: string
  version?: string
  resolved?: string
  dependencies?: Record<string, RuntimePackageDependencyTreeNode>
}

export function resolveRuntimeHostPackageContext(startDir: string): RuntimeHostPackageContext {
  let currentDir = startDir
  let openspecuiPackage: RuntimeHostPackageContext | null = null
  let serverPackage: RuntimeHostPackageContext | null = null

  while (true) {
    const packageJsonPath = join(currentDir, 'package.json')
    if (existsSync(packageJsonPath)) {
      const parsed = readRuntimeHostPackageJson(packageJsonPath)
      if (parsed.name === 'openspecui' && !openspecuiPackage) {
        openspecuiPackage = {
          packageName: 'openspecui',
          packageJsonPath,
          packageDir: currentDir,
        }
      } else if (parsed.name === '@openspecui/server' && !serverPackage) {
        serverPackage = {
          packageName: '@openspecui/server',
          packageJsonPath,
          packageDir: currentDir,
        }
      }
    }

    const parentDir = dirname(currentDir)
    if (parentDir === currentDir) break
    currentDir = parentDir
  }

  if (openspecuiPackage) return openspecuiPackage
  if (serverPackage) return serverPackage
  throw new Error('Cannot resolve the OpenSpecUI runtime package root.')
}

export function readRuntimeHostPackageDependencyRequest(input: {
  runtimeHost: RuntimeHostPackageContext
  packageName: string
  fallbackRange: string
}): string {
  const parsed = readRuntimeHostPackageJson(input.runtimeHost.packageJsonPath)
  const range =
    parsed.optionalDependencies?.[input.packageName] ??
    parsed.dependencies?.[input.packageName] ??
    input.fallbackRange
  return `${input.packageName}@${range}`
}

export async function readRuntimeHostPackageDependencyTree(input: {
  runtimeHost: RuntimeHostPackageContext
  packageNames: readonly string[]
}): Promise<RuntimePackageDependencyTreeNode> {
  const args = ['list', '--json', '--omit=dev', '--depth=1', ...input.packageNames]
  const child = spawn('npm', args, {
    cwd: input.runtimeHost.packageDir,
    shell: false,
    env: createCleanCliEnv(),
  })

  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []

  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk.toString())
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString())
    })
    child.on('error', (error) => {
      reject(error)
    })
    child.on('close', (code) => {
      resolve(code)
    })
  })

  const stdout = stdoutChunks.join('').trim()
  if (!stdout) {
    const stderr = stderrChunks.join('').trim()
    const suffix = stderr ? ` ${stderr}` : ''
    throw new Error(`npm list did not return runtime dependency JSON.${suffix}`)
  }

  try {
    return JSON.parse(stdout) as RuntimePackageDependencyTreeNode
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Failed to parse runtime dependency tree from npm list (exit ${exitCode ?? 'unknown'}): ${message}`
    )
  }
}

export function hasRuntimePackageDependencyPath(
  tree: RuntimePackageDependencyTreeNode,
  path: readonly string[]
): boolean {
  let currentNode: RuntimePackageDependencyTreeNode | undefined = tree
  for (const packageName of path) {
    currentNode = currentNode?.dependencies?.[packageName]
    if (!currentNode) {
      return false
    }
  }
  return true
}

export function normalizeRuntimeHostOptionalDependencies(input: {
  runtimeHost: RuntimeHostPackageContext
  packageNames: readonly string[]
}): void {
  const parsed = readRuntimeHostPackageJson(input.runtimeHost.packageJsonPath)
  const dependencies = { ...(parsed.dependencies ?? {}) }
  const optionalDependencies = parsed.optionalDependencies ?? {}
  let changed = false

  for (const packageName of input.packageNames) {
    if (optionalDependencies[packageName] && dependencies[packageName]) {
      delete dependencies[packageName]
      changed = true
    }
  }

  if (!changed) return

  if (Object.keys(dependencies).length === 0) {
    delete parsed.dependencies
  } else {
    parsed.dependencies = dependencies
  }
  writeFileSync(input.runtimeHost.packageJsonPath, `${JSON.stringify(parsed, null, 2)}\n`)
}

function readRuntimeHostPackageJson(packageJsonPath: string): RuntimeHostPackageJson {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as RuntimeHostPackageJson
}
