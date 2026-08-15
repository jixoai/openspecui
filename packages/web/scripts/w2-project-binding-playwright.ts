/**
 * Orthogonal intents (updated 2026-08-08 Asia/Shanghai):
 * 1. Execute one deterministic same-origin Project Binding A-to-B acceptance flow.
 * 2. Pin the OpenSpec 1.7 executable, Store registry scope, and disposable roots.
 * 3. Assert desktop/mobile layout and browser error hygiene with bounded process-tree cleanup.
 * 4. Resolve repository, temporary, and isolated home paths through native Windows APIs.
 * 5. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-19): "只需要做好单位页面验收以及多标签页面的单元测试。"
 * Derived requirement (2026-07-20): W2 B2.5 needs one bounded Playwright fixture; manual
 * multi-tab acceptance remains owner-owned. This command is intentionally excluded from the
 * default browser lane and does not exercise App iframe or WebSocket error-propagation policy.
 * Original request (2026-08-03): release OpenSpecUI 7.0.0 against the pinned OpenSpec CLI 1.7 source.
 * Original request (2026-08-04): "?????????macOS???????????Windows????????????"
 */
import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer as createNetServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { terminateChildProcessTree } from '../../core/src/child-process-tree.js'

const execFileAsync = promisify(execFile)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const TSX_CLI = join(REPO_ROOT, 'packages/web/node_modules/tsx/dist/cli.mjs')
const VITE_CLI = join(REPO_ROOT, 'packages/web/node_modules/vite/bin/vite.js')
const PINNED_OPENSPEC_ROOT = join(REPO_ROOT, 'references/openspec')
const PINNED_OPENSPEC_BIN = join(PINNED_OPENSPEC_ROOT, 'bin/openspec.js')
const PINNED_OPENSPEC_COMMIT = '2826b8889e5223a9a8095d4428b60b56597e1020'
const BACKEND_PORT = 14_236
const WEB_PORT = 14_237
const STARTUP_TIMEOUT_MS = 30_000
const ACTION_TIMEOUT_MS = 20_000
const CLEANUP_TIMEOUT_MS = 5_000

interface CliRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

const children: ChildProcess[] = []

function fixtureEnv(dataHome: string): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const homeDir = join(dataHome, 'home')
  for (const key of [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
    'NO_PROXY',
    'no_proxy',
  ]) {
    delete env[key]
  }
  return {
    ...env,
    XDG_DATA_HOME: dataHome,
    HOME: homeDir,
    USERPROFILE: homeDir,
    XDG_CONFIG_HOME: join(dataHome, 'config'),
    XDG_STATE_HOME: join(dataHome, 'state'),
    XDG_CACHE_HOME: join(dataHome, 'cache'),
    OPEN_SPEC_INTERACTIVE: '0',
    OPENSPEC_TELEMETRY: '0',
    NO_COLOR: '1',
    NODE_OPTIONS: [process.env.NODE_OPTIONS, '--conditions=development'].filter(Boolean).join(' '),
  }
}

function timeoutAfter(ms: number, label: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
}

async function runPinnedCli(
  args: readonly string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<CliRunResult> {
  try {
    const result = await execFileAsync(process.execPath, [PINNED_OPENSPEC_BIN, ...args], {
      cwd,
      env,
      timeout: ACTION_TIMEOUT_MS,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }
  } catch (error) {
    const typed = error as NodeJS.ErrnoException & {
      stdout?: string
      stderr?: string
      code?: number | string
    }
    return {
      exitCode: typeof typed.code === 'number' ? typed.code : 1,
      stdout: typed.stdout ?? '',
      stderr: typed.stderr ?? typed.message,
    }
  }
}

async function assertPinnedCli(env: NodeJS.ProcessEnv): Promise<void> {
  await access(PINNED_OPENSPEC_BIN)
  await access(TSX_CLI)
  await access(VITE_CLI)
  const { stdout } = await execFileAsync('git', ['-C', PINNED_OPENSPEC_ROOT, 'rev-parse', 'HEAD'], {
    cwd: REPO_ROOT,
    env,
    windowsHide: true,
  })
  if (stdout.trim() !== PINNED_OPENSPEC_COMMIT) {
    throw new Error(`Pinned OpenSpec SHA mismatch: ${stdout.trim()}`)
  }
  const version = await runPinnedCli(['--version'], REPO_ROOT, env)
  if (version.exitCode !== 0 || version.stdout.trim() !== '1.9.0') {
    throw new Error(`Pinned OpenSpec version check failed: ${version.stdout}\n${version.stderr}`)
  }
}

async function assertPortAvailable(port: number): Promise<void> {
  const probe = createNetServer()
  await new Promise<void>((resolvePromise, reject) => {
    const onError = (error: Error) => {
      probe.removeListener('listening', onListening)
      reject(new Error(`Fixture port ${port} is already in use: ${error.message}`))
    }
    const onListening = () => {
      probe.removeListener('error', onError)
      probe.close((error) => (error ? reject(error) : resolvePromise()))
    }
    probe.once('error', onError)
    probe.once('listening', onListening)
    probe.listen(port, '127.0.0.1')
  })
}

async function setupStore(
  id: string,
  root: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<void> {
  const result = await runPinnedCli(
    ['store', 'setup', id, '--path', root, '--no-init-git', '--json'],
    cwd,
    env
  )
  if (result.exitCode !== 0) {
    throw new Error(`Store ${id} setup failed:\n${result.stdout}\n${result.stderr}`)
  }
}

function spawnChild(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  cwd = REPO_ROOT
): ChildProcess {
  const child = spawn(command, args, {
    cwd,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  const output: string[] = []
  child.stdout?.on('data', (chunk: Buffer) => output.push(chunk.toString()))
  child.stderr?.on('data', (chunk: Buffer) => output.push(chunk.toString()))
  child.once('exit', (code, signal) => {
    if (code !== 0 && signal === null) {
      process.stderr.write(output.join(''))
    }
  })
  children.push(child)
  return child
}

async function waitForHttp(url: string, label: string): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  let lastError = 'no response'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) })
      if (response.ok) return
      lastError = `${response.status} ${response.statusText}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 200))
  }
  throw new Error(`${label} did not become ready: ${lastError}`)
}

function captureBrowserErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

async function assertNoHorizontalOverflow(page: Page, viewport: string): Promise<void> {
  const geometry = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  if (geometry.scrollWidth > geometry.clientWidth) {
    throw new Error(
      `${viewport} viewport overflows horizontally: ${geometry.scrollWidth} > ${geometry.clientWidth}`
    )
  }
}

async function pageStateForFailure(page: Page): Promise<string> {
  return page.evaluate(() => {
    const activePanel = document.querySelector('[data-tab-panel-state="active"]')
    const store = document.querySelector<HTMLInputElement>('#project-binding-store')
    const rootTexts = Array.from(document.querySelectorAll('body *'))
      .map((element) => element.textContent?.trim() ?? '')
      .filter((text) => text.includes('/root-') || text.includes('Planning root:'))
      .slice(0, 12)
    return JSON.stringify(
      {
        url: window.location.href,
        activeTab:
          document.querySelector('[data-tab-id].tab-selected')?.textContent?.trim() ?? null,
        activePanel: activePanel?.textContent?.trim().slice(0, 2000) ?? null,
        store: store?.value ?? null,
        rootTexts,
      },
      null,
      2
    )
  })
}

async function cleanupBrowser(
  browser: Browser | null,
  context: BrowserContext | null
): Promise<void> {
  const closeContext = context
    ? Promise.resolve()
        .then(() => context.close())
        .catch(() => undefined)
    : Promise.resolve()
  const closeBrowser = browser
    ? Promise.resolve()
        .then(() => browser.close())
        .catch(() => undefined)
    : Promise.resolve()
  await Promise.race([
    Promise.all([closeContext, closeBrowser]),
    timeoutAfter(CLEANUP_TIMEOUT_MS, 'browser cleanup'),
  ]).catch(() => undefined)
}

async function cleanupChildren(): Promise<void> {
  const runningChildren = children.splice(0)
  await Promise.allSettled(
    runningChildren.map(async (child) => {
      if (typeof child.pid !== 'number') return
      if (process.platform === 'win32') {
        await terminateChildProcessTree(child, 'SIGTERM')
        return
      }
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    })
  )
  const exited = await Promise.all(
    runningChildren.map(
      (child) =>
        new Promise<boolean>((resolvePromise) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolvePromise(true)
            return
          }
          child.once('exit', () => resolvePromise(true))
          setTimeout(() => resolvePromise(false), CLEANUP_TIMEOUT_MS)
        })
    )
  )
  await Promise.allSettled(
    runningChildren.map(async (child, index) => {
      if (exited[index] || typeof child.pid !== 'number') return
      if (process.platform === 'win32') {
        await terminateChildProcessTree(child, 'SIGKILL')
        return
      }
      try {
        process.kill(-child.pid, 'SIGKILL')
      } catch {
        child.kill('SIGKILL')
      }
    })
  )
}

async function main(): Promise<void> {
  let base = ''
  let browser: Browser | null = null
  let context: BrowserContext | null = null
  try {
    base = await realpath(await mkdtemp(join(tmpdir(), 'openspecui-w2-b25-playwright-')))
    const launch = join(base, 'launch')
    const rootA = join(base, 'root-a')
    const rootB = join(base, 'root-b')
    const xdgDataHome = join(base, 'xdg-data')
    const env = fixtureEnv(xdgDataHome)
    await mkdir(join(launch, 'openspec'), { recursive: true })
    await assertPinnedCli(env)
    await assertPortAvailable(BACKEND_PORT)
    await assertPortAvailable(WEB_PORT)
    await setupStore('store-a', rootA, launch, env)
    await setupStore('store-b', rootB, launch, env)
    const canonicalRootA = await realpath(rootA)
    const canonicalRootB = await realpath(rootB)
    await writeFile(join(launch, 'openspec', 'config.yaml'), 'store: store-a\n', 'utf8')
    await writeFile(join(rootA, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8')
    await writeFile(join(rootB, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8')
    await writeFile(
      join(launch, 'openspec', '.openspecui.json'),
      JSON.stringify({ cli: { command: process.execPath, args: [PINNED_OPENSPEC_BIN] } }, null, 2),
      'utf8'
    )

    const serverEnv = { ...env, OPENSPEC_PROJECT_DIR: launch }
    spawnChild(
      process.execPath,
      [
        TSX_CLI,
        join(REPO_ROOT, 'packages/server/src/standalone.ts'),
        '--dir',
        launch,
        '--port',
        String(BACKEND_PORT),
      ],
      serverEnv
    )
    await waitForHttp(`http://127.0.0.1:${BACKEND_PORT}/api/health`, 'backend')

    spawnChild(
      process.execPath,
      [VITE_CLI, '--host', '127.0.0.1', '--port', String(WEB_PORT)],
      {
        ...env,
        OPENSPEC_SERVER_PORT: String(BACKEND_PORT),
      },
      join(REPO_ROOT, 'packages/web')
    )
    await waitForHttp(`http://127.0.0.1:${WEB_PORT}/config`, 'Project Web')

    browser = await chromium.launch({ headless: true })
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      reducedMotion: 'reduce',
    })
    const page = await context.newPage()
    const browserErrors = captureBrowserErrors(page)
    await page.goto(`http://127.0.0.1:${WEB_PORT}/config`, {
      waitUntil: 'domcontentloaded',
      timeout: ACTION_TIMEOUT_MS,
    })
    await page
      .locator('#project-binding-store')
      .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })
    const projectBindingPanel = page.locator(
      '[data-tab-panel="project-binding"][data-tab-panel-state="active"]'
    )
    await projectBindingPanel.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })
    if ((await page.locator('#project-binding-store').inputValue()) !== 'store-a') {
      throw new Error('Project Binding did not initially resolve Store A')
    }
    if (
      (await projectBindingPanel.locator('dd').filter({ hasText: canonicalRootA }).count()) !== 1
    ) {
      throw new Error('Project Binding did not initially expose Root A')
    }
    await page.locator('#project-binding-store').fill('store-b')
    await page.getByRole('button', { name: 'Save binding' }).click()
    await page
      .getByText('Launch write complete:', { exact: false })
      .waitFor({ timeout: ACTION_TIMEOUT_MS })
    await page
      .getByText('Transition: converging', { exact: false })
      .waitFor({ timeout: ACTION_TIMEOUT_MS })
    await projectBindingPanel
      .locator('dd')
      .filter({ hasText: canonicalRootB })
      .waitFor({ timeout: ACTION_TIMEOUT_MS })
    await page.getByRole('button', { name: 'Saved' }).waitFor({ timeout: ACTION_TIMEOUT_MS })
    if ((await page.locator('#project-binding-store').inputValue()) !== 'store-b') {
      throw new Error('Project Binding did not settle Store B')
    }
    const activeRootButton = page.getByRole('button', { name: 'Active Root', exact: true })
    await activeRootButton.click()
    try {
      await page.waitForFunction(
        () =>
          document
            .querySelector('button[data-tab-id="active-root"]')
            ?.classList.contains('tab-selected') === true,
        undefined,
        { timeout: ACTION_TIMEOUT_MS }
      )
      const activeRootPanel = page.locator(
        '[data-tab-panel="active-root"][data-tab-panel-state="active"]'
      )
      await activeRootPanel.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })
      const activeRootPanelCount = await activeRootPanel.count()
      if (activeRootPanelCount !== 1) {
        throw new Error(`Expected exactly one active-root panel, found ${activeRootPanelCount}`)
      }
      const activeRootEvidence = activeRootPanel.locator('p').filter({ hasText: 'Planning root:' })
      await activeRootEvidence.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })
      const activeRootEvidenceCount = await activeRootEvidence.count()
      if (activeRootEvidenceCount !== 1) {
        throw new Error(
          `Expected exactly one Active Root evidence paragraph, found ${activeRootEvidenceCount}`
        )
      }
      const activeRootText = await activeRootEvidence.textContent()
      if (!activeRootText?.includes(canonicalRootB) || !activeRootText.includes('Store store-b')) {
        throw new Error(`Unexpected Active Root evidence: ${activeRootText ?? '(empty)'}`)
      }
    } catch (error) {
      const state = await pageStateForFailure(page)
      throw new Error(
        `Active Root did not expose Root B within ${ACTION_TIMEOUT_MS}ms.\n${state}\n${String(error)}`
      )
    }
    await assertNoHorizontalOverflow(page, '1280x800')

    await context.close()
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: 'reduce',
    })
    const mobilePage = await context.newPage()
    const mobileErrors = captureBrowserErrors(mobilePage)
    await mobilePage.goto(`http://127.0.0.1:${WEB_PORT}/config`, {
      waitUntil: 'domcontentloaded',
      timeout: ACTION_TIMEOUT_MS,
    })
    await mobilePage
      .locator('#project-binding-store')
      .waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS })
    await mobilePage
      .locator('[data-tab-panel="project-binding"][data-tab-panel-state="active"] dd')
      .filter({ hasText: canonicalRootB })
      .waitFor({ timeout: ACTION_TIMEOUT_MS })
    await assertNoHorizontalOverflow(mobilePage, '390x844')
    const errors = [...browserErrors, ...mobileErrors]
    if (errors.length > 0) throw new Error(`Browser errors observed:\n${errors.join('\n')}`)
    console.log(
      JSON.stringify(
        {
          fixture: 'w2-project-binding-playwright',
          pinnedCommit: PINNED_OPENSPEC_COMMIT,
          executable: PINNED_OPENSPEC_BIN,
          dataHome: xdgDataHome,
          launch,
          rootA: canonicalRootA,
          rootB: canonicalRootB,
          desktop: '1280x800 passed',
          mobile: '390x844 passed',
          browserErrors: 0,
        },
        null,
        2
      )
    )
  } finally {
    await cleanupBrowser(browser, context)
    await cleanupChildren()
    if (base) {
      await rm(base, {
        recursive: true,
        force: true,
        maxRetries: process.platform === 'win32' ? 20 : 0,
        retryDelay: 50,
      })
    }
  }
}

await main()
