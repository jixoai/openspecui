import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

type NapiConfig = {
  binaryName?: string
  targets?: string[]
}

type PackageJson = {
  napi?: NapiConfig
}

export type NapiArtifactPlanEntry = {
  artifactFileName: string
  platformArchAbi: string
  target: string
}

export type NapiArtifactPlan = {
  binaryName: string
  entries: NapiArtifactPlanEntry[]
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

function readPackageNapiConfig(packageDir: string): NapiConfig | null {
  const separatedConfigPath = join(packageDir, 'napi.config.json')
  if (existsSync(separatedConfigPath)) {
    return readJson<NapiConfig>(separatedConfigPath)
  }

  const packageJsonPath = join(packageDir, 'package.json')
  if (!existsSync(packageJsonPath)) return null
  const packageJson = readJson<PackageJson>(packageJsonPath)
  return packageJson.napi ?? null
}

function toPlatformArchAbi(target: string): string {
  if (target === 'universal-apple-darwin') return 'darwin-universal'
  if (target === 'wasm32-wasi-preview1-threads' || target === 'wasm32-wasip1-threads') {
    return 'wasm32-wasi'
  }

  const normalized = target.endsWith('eabi') ? `${target.slice(0, -4)}-eabi` : target
  const triples = normalized.split('-')

  let cpu: string
  let sys: string
  let abi: string | null = null
  if (triples.length === 2) {
    ;[cpu, sys] = triples
  } else {
    ;[cpu, , sys, abi = null] = triples
  }

  if (abi === 'android' || abi === 'ohos') {
    sys = abi
    abi = null
  }

  const platformMap: Record<string, string> = {
    darwin: 'darwin',
    freebsd: 'freebsd',
    linux: 'linux',
    ohos: 'openharmony',
    windows: 'win32',
  }
  const archMap: Record<string, string> = {
    aarch64: 'arm64',
    armv7: 'arm',
    i686: 'ia32',
    loongarch64: 'loong64',
    powerpc64le: 'ppc64',
    riscv64gc: 'riscv64',
    x86_64: 'x64',
  }

  const platform = platformMap[sys] ?? sys
  const arch = archMap[cpu] ?? cpu
  return abi ? `${platform}-${arch}-${abi}` : `${platform}-${arch}`
}

export function readNapiArtifactPlan(packageDir: string): NapiArtifactPlan | null {
  const config = readPackageNapiConfig(packageDir)
  if (!config) return null

  const binaryName = config.binaryName ?? 'index'
  const targets = config.targets ?? []

  return {
    binaryName,
    entries: targets.map((target) => {
      const platformArchAbi = toPlatformArchAbi(target)
      const extension = platformArchAbi === 'wasm32-wasi' ? 'wasm' : 'node'
      return {
        artifactFileName: `${binaryName}.${platformArchAbi}.${extension}`,
        platformArchAbi,
        target,
      }
    }),
  }
}

export function verifyNapiPublishArtifacts(packageDir: string): void {
  const plan = readNapiArtifactPlan(packageDir)
  if (!plan) return

  const missing = plan.entries.filter(
    (entry) => !existsSync(join(packageDir, entry.artifactFileName))
  )
  if (missing.length === 0) return

  const detail = missing.map((entry) => `${entry.artifactFileName} (${entry.target})`).join(', ')
  throw new Error(`Missing NAPI publish artifacts in ${packageDir}: ${detail}`)
}
