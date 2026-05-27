const { execSync } = require('node:child_process')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function isFileMusl(file) {
  return file.includes('libc.musl-') || file.includes('ld-musl-')
}

function isMuslRuntime(runtime) {
  if (runtime.platform !== 'linux') return false

  try {
    return readFileSync('/usr/bin/ldd', 'utf8').includes('musl')
  } catch {}

  try {
    if (typeof runtime.report?.getReport === 'function') {
      runtime.report.excludeNetwork = true
      const report = runtime.report.getReport()
      if (report?.header?.glibcVersionRuntime) return false
      if (Array.isArray(report?.sharedObjects)) {
        return report.sharedObjects.some(isFileMusl)
      }
    }
  } catch {}

  try {
    return execSync('ldd --version', { encoding: 'utf8' }).includes('musl')
  } catch {
    return false
  }
}

function toPlatformArchAbi(target) {
  if (typeof target !== 'string' || target.length === 0) {
    throw new Error(`Invalid NAPI target triple: ${String(target)}`)
  }
  if (target === 'universal-apple-darwin') return 'darwin-universal'
  if (target === 'wasm32-wasi-preview1-threads' || target === 'wasm32-wasip1-threads') {
    return 'wasm32-wasi'
  }

  const normalized = target.endsWith('eabi') ? `${target.slice(0, -4)}-eabi` : target
  const triples = normalized.split('-')

  let cpu
  let sys
  let abi = null
  if (triples.length === 2) {
    ;[cpu, sys] = triples
  } else {
    ;[cpu, , sys, abi = null] = triples
  }

  if (abi === 'android' || abi === 'ohos') {
    sys = abi
    abi = null
  }

  const platformMap = {
    darwin: 'darwin',
    freebsd: 'freebsd',
    linux: 'linux',
    ohos: 'openharmony',
    windows: 'win32',
  }
  const archMap = {
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

function readSupportedPlatformArchAbis(packageDir) {
  const configPath = join(packageDir, 'napi.config.json')
  const parsed = JSON.parse(readFileSync(configPath, 'utf8'))
  const targets = Array.isArray(parsed.targets) ? parsed.targets : []
  return targets.map(toPlatformArchAbi)
}

function resolveRuntimePlatformArchAbi(runtime) {
  if (runtime.platform === 'darwin') {
    return runtime.arch === 'arm64' ? 'darwin-arm64' : runtime.arch === 'x64' ? 'darwin-x64' : null
  }
  if (runtime.platform === 'win32') {
    if (runtime.arch === 'x64') {
      if (
        runtime.config?.variables?.shlib_suffix === 'dll.a' ||
        runtime.config?.variables?.node_target_type === 'shared_library'
      ) {
        return 'win32-x64-gnu'
      }
      return 'win32-x64-msvc'
    }
    if (runtime.arch === 'ia32') return 'win32-ia32-msvc'
    if (runtime.arch === 'arm64') return 'win32-arm64-msvc'
    return null
  }
  if (runtime.platform === 'linux') {
    const musl = isMuslRuntime(runtime)
    if (runtime.arch === 'x64') return musl ? 'linux-x64-musl' : 'linux-x64-gnu'
    if (runtime.arch === 'arm64') return musl ? 'linux-arm64-musl' : 'linux-arm64-gnu'
    if (runtime.arch === 'arm') return musl ? 'linux-arm-musleabihf' : 'linux-arm-gnueabihf'
    if (runtime.arch === 'loong64') return musl ? 'linux-loong64-musl' : 'linux-loong64-gnu'
    if (runtime.arch === 'riscv64') return musl ? 'linux-riscv64-musl' : 'linux-riscv64-gnu'
    if (runtime.arch === 'ppc64') return 'linux-ppc64-gnu'
    if (runtime.arch === 's390x') return 'linux-s390x-gnu'
    return null
  }
  return null
}

function assertSupportedCt2Runtime(packageDir, runtime = process) {
  const supported = readSupportedPlatformArchAbis(packageDir)
  const runtimeTarget = resolveRuntimePlatformArchAbi(runtime)
  if (runtimeTarget && supported.includes(runtimeTarget)) {
    return {
      runtimeTarget,
      supported,
    }
  }

  const actual = runtimeTarget ?? `${runtime.platform}-${runtime.arch}`
  throw new Error(
    `Unsupported ctranslate2 runtime target: ${actual}. Supported native targets: ${supported.join(', ')}.`
  )
}

function normalizeForceWasiFlag(env = process.env) {
  const value = env.NAPI_RS_FORCE_WASI
  if (value === 'true' || value === 'error') return
  delete env.NAPI_RS_FORCE_WASI
}

module.exports = {
  assertSupportedCt2Runtime,
  normalizeForceWasiFlag,
  readSupportedPlatformArchAbis,
  resolveRuntimePlatformArchAbi,
  toPlatformArchAbi,
}
