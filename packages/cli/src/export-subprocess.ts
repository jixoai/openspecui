/**
 * Orthogonal intents (created 2026-08-09 Asia/Shanghai):
 * 1. Run export build and preview subprocesses through one argv-preserving native boundary.
 * 2. Hide export subprocess console windows (`windowsHide`) under a console-less Windows parent.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "Make pnpm openspecui start and equivalent package scripts work on Windows."
 */
import { resolveCommandInvocation } from '@openspecui/core'
import { spawn } from 'node:child_process'

export interface ExportSubprocessOptions {
  readonly args: readonly string[]
  readonly command: string
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
}

/** Run one inherited export subprocess without a shell or `.cmd` argv reinterpretation. */
export function runExportSubprocess(options: ExportSubprocessOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = options.env ?? process.env
    const invocation = resolveCommandInvocation(options.command, options.args, {
      cwd: options.cwd,
      env,
    })
    const child = spawn(invocation.command, invocation.args, {
      cwd: options.cwd,
      env,
      shell: false,
      stdio: 'inherit',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${options.command} failed with exit code ${code ?? 'unknown'}`))
    })
  })
}
