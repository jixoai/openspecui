/**
 * Orthogonal intents (updated 2026-08-09 Asia/Shanghai):
 * 1. Execute native Windows tools and command shims through the generic subprocess resolver.
 * 2. Prevent release scripts from restoring platform-specific command-name rewrites.
 * 3. Keep the Bun release runtime on the shared argv-safe invocation owner.
 * 4. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-08-04): "这个项目之前都是在macOS上做到开发，现在我们在Windows，所以开始一系列的适配。"
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveCommandInvocation } from './lib/command-invocation.mjs'

describe('shell-independent command invocation', () => {
  it.each(['git', 'npm'])('executes the current-platform %s command', (command) => {
    const invocation = resolveCommandInvocation(command, ['--version'])
    const result = spawnSync(invocation.command, invocation.args, {
      encoding: 'utf8',
      windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      windowsHide: true,
    })

    expect(
      result.status,
      JSON.stringify({
        args: invocation.args,
        command: invocation.command,
        error: result.error?.message ?? null,
        stderr: result.stderr,
      })
    ).toBe(0)
    expect(result.stdout.trim()).not.toBe('')
  })

  it('keeps release entrypoints on the shared command resolver', () => {
    for (const relativePath of [
      './changeversion-auto.ts',
      './create-github-release.ts',
      './lib/changeversion/pr-mergeability.ts',
      './lib/changeversion/release-workflow.ts',
      './lib/release/runtime.ts',
      './publish-packages.ts',
    ]) {
      const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8')
      expect(source).toContain('resolveCommandInvocation')
      expect(source).not.toMatch(/['"`][^'"`\r\n]*\.cmd['"`]|\$\{bin\}\.cmd/i)
      expect(source).not.toContain("process.platform === 'win32' ? 'gh.exe'")
    }
  })
})
