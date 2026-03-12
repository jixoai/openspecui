#!/usr/bin/env node
import process from 'node:process'

import { computeCiScopeFromGit } from './lib/ci-scope.mjs'

const rootDir = process.cwd()
const baseSha = process.env.CI_SCOPE_BASE_SHA ?? ''
const headSha = process.env.CI_SCOPE_HEAD_SHA ?? process.env.GITHUB_SHA ?? 'HEAD'
const scope = computeCiScopeFromGit({ baseSha, headSha, rootDir })
const scopeJson = JSON.stringify(scope)
const browserMatrix = []
if (scope.browser.runXterm) {
  browserMatrix.push({
    id: 'xterm',
    label: 'xterm-input-panel',
    playwright_install:
      'pnpm --filter xterm-input-panel exec playwright install --with-deps chromium',
    test_command: 'pnpm --filter xterm-input-panel test:browser',
  })
}
if (scope.browser.runWeb) {
  browserMatrix.push({
    id: 'web',
    label: '@openspecui/web',
    playwright_install:
      'pnpm --filter @openspecui/web exec playwright install --with-deps chromium',
    test_command: 'pnpm --filter @openspecui/web test:browser:ci',
  })
}
const browserMatrixJson = JSON.stringify(browserMatrix)

console.log(scopeJson)

if (process.env.GITHUB_OUTPUT) {
  const lines = [
    `scope_json=${scopeJson}`,
    `fast_mode=${scope.fast.mode}`,
    `fast_required=${scope.fast.required}`,
    `browser_required=${scope.browser.required}`,
    `run_web=${scope.browser.runWeb}`,
    `run_xterm=${scope.browser.runXterm}`,
    `browser_matrix=${browserMatrixJson}`,
  ]
  await import('node:fs').then(({ appendFileSync }) => {
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`)
  })
}
