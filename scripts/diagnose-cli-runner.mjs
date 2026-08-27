#!/usr/bin/env node
/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Reproduce the production CLI-runner resolution path and report every candidate attempt (no short-circuit).
 * 2. Surface Windows npm-global extension-less shim defects that `spawn({shell:false})` cannot execute.
 * 3. Emit machine-readable JSON via --json so users can paste objective evidence into bug reports.
 * 4. Resolve Windows command shims without shell argv loss and retire timed-out probe trees safely.
 * 5. Let stdout/stderr flush before publishing the diagnostic exit status.
 * 6. Hide probe subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 * 7. Probe the same pinned CLI series fallbacks as production instead of an unversioned @latest.
 *
 * Original request (2026-08-28, issue #258): "No available OpenSpec CLI runner." — the diagnostic
 *   must reproduce the production candidate set, including its series-pinned fallback specs.
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-30, issue #209): "看一下 issues209，分析一下可能的问题，以及我们应该提供什么分析工具或者分析脚本"
 * Owner decision (2026-07-30): ship a zero-dependency diagnostic script first; CLI integration is deferred
 *   until it proves useful in real environments.
 * Compromise (2026-08-09): this plain-Node zero-dependency diagnostic mirrors the Core Windows
 *   PID/executable verification locally because it cannot import repository TypeScript source.
 *
 * Scope: this script READS the environment and PROBES candidates exactly like
 * packages/core/src/config.ts does. It never mutates anything and never installs packages.
 * The npx/bunx/... probes DO attempt real `--version` invocations, which may download a
 * package on first run (same as production resolution). Pass --no-network to skip them.
 */
import { execFile, spawn } from 'node:child_process'
import { arch, homedir, platform } from 'node:os'
import { resolve, win32 } from 'node:path'
import process, { argv, cwd, env as nodeEnv, stderr, stdout, versions } from 'node:process'
import {
  resolveCommandInvocation,
  resolveWindowsCommandInvocation,
} from './lib/command-invocation.mjs'

const CLI_PROBE_TIMEOUT_MS = Number(nodeEnv.OPENSPECUI_CLI_PROBE_TIMEOUT_MS) || 20_000
const SHELL_RESOLVE_TIMEOUT_MS = 5_000

// Mirror of packages/core OPENSPEC_CLI_TARGET_SERIES: fallback probes must resolve the series
// the release line admits, never an unversioned @latest the compatibility gate can block.
const OPENSPEC_CLI_TARGET_SERIES = '1.9'
const OPENSPEC_CLI_FALLBACK_SPEC = `@fission-ai/openspec@${OPENSPEC_CLI_TARGET_SERIES}`

const PACKAGE_MANAGER_RUNNERS = [
  { id: 'npx', source: 'npx', commandParts: ['npx', '-y', OPENSPEC_CLI_FALLBACK_SPEC] },
  { id: 'bunx', source: 'bunx', commandParts: ['bunx', OPENSPEC_CLI_FALLBACK_SPEC] },
  {
    id: 'deno',
    source: 'deno',
    commandParts: ['deno', 'run', '-A', `npm:${OPENSPEC_CLI_FALLBACK_SPEC}`],
  },
  { id: 'pnpm', source: 'pnpm', commandParts: ['pnpm', 'dlx', OPENSPEC_CLI_FALLBACK_SPEC] },
  { id: 'yarn', source: 'yarn', commandParts: ['yarn', 'dlx', OPENSPEC_CLI_FALLBACK_SPEC] },
]

function isBareExecutable(command) {
  if (!command) return false
  if (command === '.' || command === '..') return false
  return !/[\\/]/.test(command)
}

/**
 * Quote an arg for a POSIX login shell. Only used on non-Windows to mirror production.
 */
function quotePosixShellArg(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Return EVERY path a shell `where`/`which` lookup would surface for a bare command.
 * Production resolves only the first one; reporting all of them exposes the Windows
 * extension-less shim defect directly.
 */
async function resolveShellCandidates(command, workdir, probeEnv) {
  if (!isBareExecutable(command)) return []
  try {
    if (platform() === 'win32') {
      const { stdout } = await execFileAsyncP('where.exe', [command], {
        cwd: workdir,
        env: probeEnv,
        encoding: 'utf8',
        timeout: SHELL_RESOLVE_TIMEOUT_MS,
        windowsHide: true,
      })
      return stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    }
    const shell = probeEnv.SHELL || '/bin/sh'
    const { stdout } = await execFileAsyncP(
      shell,
      [
        '-lc',
        `command -v -- ${quotePosixShellArg(command)}; type -ap -- ${quotePosixShellArg(command)} 2>/dev/null`,
      ],
      { cwd: workdir, env: probeEnv, encoding: 'utf8', timeout: SHELL_RESOLVE_TIMEOUT_MS }
    )
    const seen = new Set()
    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('/'))
      .filter((line) => {
        if (seen.has(line)) return false
        seen.add(line)
        return true
      })
  } catch {
    return []
  }
}

const execFileAsyncP = (cmd, args, opts) =>
  new Promise((res, rej) => {
    execFile(cmd, args, opts, (err, stdoutText, stderrText) => {
      if (err) rej(err)
      else res({ stdout: stdoutText, stderr: stderrText })
    })
  })

/**
 * Classify a resolved path for Windows: which PATHEXT extension (if any) makes it executable.
 * An extension-less path (the npm shim for Git Bash) cannot be executed by `spawn({shell:false})`.
 */
function classifyWindowsPath(fsPath, pathExt) {
  if (!fsPath) return { executable: false, reason: 'empty' }
  const lower = fsPath.toLowerCase()
  const exts = (pathExt || '.COM;.EXE;.BAT;.CMD;.VBS;.JS;.WS;.MSC')
    .split(';')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  for (const ext of exts) {
    if (lower.endsWith(ext)) return { executable: true, ext }
  }
  return {
    executable: false,
    reason: 'no PATHEXT match; spawn({shell:false}) will fail with ENOENT',
  }
}

function formatToken(token) {
  if (!token) return '""'
  if (!/[\s"'\\]/.test(token)) return token
  return JSON.stringify(token)
}

function commandToString(parts) {
  return parts.map(formatToken).join(' ').trim()
}

function resolveProbeInvocation(commandParts) {
  const [command, ...args] = commandParts
  const versionArgs = [...args, '--version']
  if (platform() !== 'win32') return { command, args: versionArgs }
  if (isBareExecutable(command)) return resolveCommandInvocation(command, versionArgs)
  if (command.toLowerCase().endsWith('.cmd')) {
    return resolveWindowsCommandInvocation(command, versionArgs, [command])
  }
  return { command, args: versionArgs }
}

async function terminateProbeTree(child, expectedExecutablePath) {
  if (platform() !== 'win32') {
    child.kill()
    return
  }
  if (typeof child.pid !== 'number') return
  const query = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Get-CimInstance Win32_Process -Filter "ProcessId = ${child.pid}" | Select-Object ProcessId,ExecutablePath | ConvertTo-Json -Compress`
  const { stdout: processJson } = await execFileAsyncP(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', query],
    { encoding: 'utf8', timeout: SHELL_RESOLVE_TIMEOUT_MS, windowsHide: true }
  )
  if (!processJson.trim()) return
  const record = JSON.parse(processJson)
  const expected = win32.normalize(expectedExecutablePath).toLowerCase()
  const actual =
    typeof record.ExecutablePath === 'string'
      ? win32.normalize(record.ExecutablePath).toLowerCase()
      : null
  if (actual !== expected) {
    throw new Error(
      `Refusing to terminate PID ${child.pid}: expected ${expected}, observed ${actual ?? 'no executable path'}.`
    )
  }
  await execFileAsyncP('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
    encoding: 'utf8',
    timeout: SHELL_RESOLVE_TIMEOUT_MS,
    windowsHide: true,
  })
}

function probeOne(commandParts, workdir, probeEnv) {
  return new Promise((resolveProbe) => {
    let stdoutStr = ''
    let stderrStr = ''
    let timedOut = false
    let settled = false
    let timer = null
    let terminationError = null

    const finish = (result) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      resolveProbe(result)
    }

    let child
    let invocation
    try {
      invocation = resolveProbeInvocation(commandParts)
      child = spawn(invocation.command, invocation.args, {
        cwd: workdir,
        shell: false,
        env: probeEnv,
        windowsHide: true,
      })
    } catch (err) {
      finish({
        command: commandToString(commandParts),
        success: false,
        error: err instanceof Error ? `${err.message}` : String(err),
        exitCode: null,
        spawnStage: invocation ? 'sync-throw' : 'resolve',
      })
      return
    }

    timer = setTimeout(() => {
      timedOut = true
      void terminateProbeTree(child, invocation.command).catch((error) => {
        terminationError = error instanceof Error ? error.message : String(error)
        try {
          child.kill()
        } catch {
          // The close/error event remains the result authority.
        }
      })
    }, CLI_PROBE_TIMEOUT_MS)

    child.stdout?.on('data', (d) => {
      stdoutStr += d.toString()
    })
    child.stderr?.on('data', (d) => {
      stderrStr += d.toString()
    })
    child.on('error', (err) => {
      finish({
        command: commandToString(commandParts),
        success: false,
        error: `${err.message} (code=${err.code ?? 'n/a'})`,
        stderr: stderrStr.trim() || undefined,
        exitCode: null,
        timedOut,
        spawnStage: 'async-error',
      })
    })
    child.on('close', (exitCode) => {
      if (exitCode === 0 && !timedOut) {
        const version = stdoutStr.trim().split('\n')[0] || undefined
        finish({
          command: commandToString(commandParts),
          success: true,
          version,
          exitCode,
          spawnStage: 'close',
        })
        return
      }
      finish({
        command: commandToString(commandParts),
        success: false,
        error: timedOut
          ? `CLI probe timed out${terminationError ? `; ${terminationError}` : ''}`
          : stderrStr.trim() || `Exit code ${exitCode ?? 'null'}`,
        stderr: stderrStr.trim() || undefined,
        exitCode,
        timedOut,
        spawnStage: 'close',
      })
    })
  })
}

function buildCandidates({ includeNetwork }) {
  const candidates = [{ id: 'openspec', source: 'openspec', commandParts: ['openspec'] }]
  if (includeNetwork) {
    candidates.push(...PACKAGE_MANAGER_RUNNERS)
  }
  return candidates
}

async function detectWindowsNpmGlobalBin() {
  if (platform() !== 'win32') return undefined
  try {
    const invocation = resolveCommandInvocation('npm', ['config', 'get', 'prefix'])
    const { stdout } = await execFileAsyncP(invocation.command, invocation.args, {
      encoding: 'utf8',
      timeout: SHELL_RESOLVE_TIMEOUT_MS,
      windowsHide: true,
    })
    const prefix = stdout.trim()
    if (!prefix) return undefined
    return resolve(prefix, 'npm')
  } catch {
    return undefined
  }
}

async function collectEnvironment() {
  const info = {
    platform: platform(),
    arch: arch(),
    nodeVersion: versions.node,
    workdir: cwd(),
    shell: nodeEnv.SHELL || null,
    pathExt: nodeEnv.PATHEXT || null,
    home: homedir(),
    npmConfigUserAgent: nodeEnv.npm_config_user_agent || null,
    npmExecpath: nodeEnv.npm_execpath || null,
    appdata: nodeEnv.APPDATA || null,
  }
  if (platform() === 'win32') {
    info.npmGlobalBin = await detectWindowsNpmGlobalBin()
  }
  return info
}

async function main() {
  const args = argv.slice(2)
  const asJson = args.includes('--json')
  const skipNetwork = args.includes('--no-network')

  const envInfo = await collectEnvironment()
  const workdir = cwd()
  const probeEnv = { ...nodeEnv }

  // 1. Shell resolution for the bare `openspec` command (mirrors production expansion).
  const openspecShellCandidates = await resolveShellCandidates('openspec', workdir, probeEnv)
  const shellProjections = openspecShellCandidates.map((fsPath) => {
    if (platform() === 'win32') {
      return { path: fsPath, ...classifyWindowsPath(fsPath, envInfo.pathExt) }
    }
    return { path: fsPath, executable: true }
  })

  // 2. Full candidate probing — NO short-circuit. Production stops at the first success;
  //    here we run every candidate so a working fallback is visible alongside the failing one.
  const baseCandidates = buildCandidates({ includeNetwork: !skipNetwork })
  const expanded = []
  for (const candidate of baseCandidates) {
    const firstPart = candidate.commandParts[0]
    if (candidate.id === 'openspec') {
      for (const resolvedPath of openspecShellCandidates) {
        if (resolvedPath && resolvedPath !== firstPart) {
          expanded.push({
            ...candidate,
            source: `${candidate.source} (shell-resolved)`,
            commandParts: [resolvedPath, ...candidate.commandParts.slice(1)],
          })
        }
      }
    }
    expanded.push(candidate)
  }

  const attempts = []
  for (const candidate of expanded) {
    const attempt = await probeOne(candidate.commandParts, workdir, probeEnv)
    attempts.push({ source: candidate.source, ...attempt })
  }

  // 3. Diagnosis heuristic: does any attempt succeed?
  const firstSuccess = attempts.find((a) => a.success) || null

  const report = {
    generatedAt: new Date().toISOString(),
    environment: envInfo,
    openspecShellResolution: shellProjections,
    attempts,
    resolved: firstSuccess,
  }

  if (asJson) {
    stdout.write(`${JSON.stringify(report, null, 2)}\n`)
    process.exitCode = firstSuccess ? 0 : 1
    return
  }

  // Human-readable output
  const out = []
  const println = (line) => out.push(line)
  println(`openspecui CLI-runner diagnostic`)
  println(`generated: ${report.generatedAt}`)
  println(``)
  println(`Environment`)
  println(`  platform      : ${envInfo.platform} / ${envInfo.arch}`)
  println(`  node          : ${envInfo.nodeVersion}`)
  println(`  workdir       : ${envInfo.workdir}`)
  if (envInfo.pathExt) println(`  PATHEXT       : ${envInfo.pathExt}`)
  if (envInfo.npmConfigUserAgent) println(`  npm UA        : ${envInfo.npmConfigUserAgent}`)
  if (envInfo.npmExecpath) println(`  npm_execpath  : ${envInfo.npmExecpath}`)
  if (envInfo.appdata) println(`  APPDATA       : ${envInfo.appdata}`)
  if (envInfo.npmGlobalBin) println(`  npm -g bin    : ${envInfo.npmGlobalBin}`)
  println(``)

  println(`Shell resolution for bare \`openspec\``)
  if (shellProjections.length === 0) {
    println(`  (no path found via where/which)`)
  } else {
    shellProjections.forEach((p, i) => {
      const flag = p.executable ? 'OK ' : 'BAD'
      const note = p.executable ? `extension ${p.ext}` : `${p.reason}`
      println(`  [${i}] ${flag}  ${p.path}`)
      println(`        ${note}`)
    })
  }
  println(``)

  println(
    `Candidate probe (${skipNetwork ? 'package managers skipped via --no-network' : 'all candidates'})`
  )
  attempts.forEach((a) => {
    const mark = a.success ? 'PASS' : 'FAIL'
    const head = `  [${mark}] ${a.source.padEnd(22)} ${a.command}`
    if (a.success) {
      println(`${head}  -> ${a.version}`)
    } else {
      println(`${head}`)
      println(`        ${a.error}`)
      if (a.stderr) println(`        stderr: ${a.stderr}`)
    }
  })
  println(``)

  if (firstSuccess) {
    println(
      `Resolved usable runner: ${firstSuccess.source} -> ${firstSuccess.command} (${firstSuccess.version})`
    )
  } else {
    println(`Resolved usable runner: NONE`)
    if (
      platform() === 'win32' &&
      shellProjections.some((p) => !p.executable) &&
      shellProjections.some((p) => p.executable)
    ) {
      println(``)
      println(`Likely cause (Windows): \`where openspec\` returns the extension-less npm shim`)
      println(`first; Node \`spawn({shell:false})\` cannot execute it. The matching .cmd/.ps1`)
      println(`exists but is never selected. This is the OpenSpecUI issue #209 pattern.`)
      println(`Workaround: configure an explicit runner with a .cmd extension, or use a`)
      println(`package manager (npx/pnpm) if available.`)
    } else if (
      platform() === 'win32' &&
      shellProjections.some((p) => !p.executable) &&
      !shellProjections.some((p) => p.executable)
    ) {
      println(``)
      println(`Likely cause (Windows): the npm global bin only exposes the extension-less`)
      println(`shim; no .cmd/.ps1/.exe was found. Reinstall the package or check the`)
      println(`global prefix permissions.`)
    } else if (attempts.every((a) => !a.success && /ENOENT/.test(a.error || ''))) {
      println(``)
      println(`Likely cause: no \`openspec\` and no package manager (npx/pnpm/yarn/bun/deno)`)
      println(`were reachable on PATH. Install OpenSpec CLI globally, or install a package`)
      println(`manager and let OpenSpecUI fall back to it.`)
    }
  }

  if (skipNetwork) {
    println(``)
    println(`Note: --no-network skipped npx/bunx/pnpm/yarn/deno probes.`)
  }
  println(``)
  println(`Re-run with --json for a machine-readable report to attach to your issue.`)

  stderr.write(`${out.join('\n')}\n`)
  process.exitCode = firstSuccess ? 0 : 1
}

main().catch((err) => {
  stderr.write(`Diagnostic failed: ${err instanceof Error ? err.stack : String(err)}\n`)
  process.exitCode = 2
})
