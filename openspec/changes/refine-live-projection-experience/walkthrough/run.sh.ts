/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Start App and project backends in explicit foreground terminals.
 * 2. Report reachability and run objective loading benchmarks without browser automation.
 * 3. Replay focused unit/component evidence for the full-surface loading contract.
 * 4. Open exact missing/invalid credential pages for terminal authentication acceptance.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 * Original request (2026-07-28): "我需要非常具体的验收工具和验收流程"
 */
import {
  defaultLabDirectory,
  hideWalkthroughBin,
  openSpecEnvironment,
  repositoryRoot,
  requirePreparedLab,
  resolveLab,
  runCommand,
  targetFor,
  walkthroughYargs,
} from './shared.ts'

async function startApp(labDirectory: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  await runCommand({
    command: 'pnpm',
    args: [
      '--filter',
      '@openspecui/app',
      'dev',
      '--host',
      '127.0.0.1',
      '--port',
      String(lab.appPort),
      '--strictPort',
    ],
    cwd: repositoryRoot,
  })
}

async function startBackend(labDirectory: string, rawId: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  const target = targetFor(lab, rawId)
  await runCommand({
    command: 'pnpm',
    args: [
      'openspecui',
      '--',
      target.projectDir,
      '--port',
      String(target.port),
      `--app=${lab.appUrl}`,
      '--auth',
    ],
    cwd: repositoryRoot,
    env: openSpecEnvironment(target.dataHome),
  })
}

async function openPage(input: {
  labDirectory: string
  rawId: string
  credential: 'missing' | 'invalid'
  printOnly: boolean
}): Promise<void> {
  const lab = resolveLab(input.labDirectory)
  await requirePreparedLab(lab)
  const target = targetFor(lab, input.rawId)
  const url = new URL(`http://127.0.0.1:${String(target.port)}/dashboard`)
  if (input.credential === 'invalid') url.hash = 'credential=invalid'
  console.log(url.href)
  if (input.printOnly) return
  await runCommand({ command: 'open', args: [url.href], cwd: repositoryRoot })
}

async function status(labDirectory: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  const endpoints = [
    { label: 'App', url: lab.appUrl },
    ...Object.values(lab.targets).flatMap((target) => [
      { label: `Backend ${target.id.toUpperCase()} shell`, url: `http://127.0.0.1:${target.port}` },
      {
        label: `Backend ${target.id.toUpperCase()} protected health`,
        url: `http://127.0.0.1:${target.port}/api/health`,
      },
    ]),
  ]
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, { redirect: 'manual' })
      console.log(`${endpoint.label}: HTTP ${response.status}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`${endpoint.label}: unavailable (${message})`)
    }
  }
  console.log(
    'Protected health should return 401 when this credential-free status probe reaches it.'
  )
}

async function benchmark(input: {
  labDirectory: string
  rawId: string
  scenario: string
  timeout: number
}): Promise<void> {
  const lab = resolveLab(input.labDirectory)
  await requirePreparedLab(lab)
  const target = targetFor(lab, input.rawId)
  await runCommand({
    command: 'pnpm',
    args: [
      '--filter',
      '@openspecui/server',
      'exec',
      'tsx',
      'bench/live-projection-loading.bench.ts',
      '--dir',
      target.projectDir,
      '--port',
      String(target.benchmarkPort),
      '--timeout',
      String(input.timeout),
      '--scenario',
      input.scenario,
    ],
    cwd: repositoryRoot,
    env: openSpecEnvironment(target.dataHome),
  })
}

async function verifyFocused(): Promise<void> {
  await runCommand({
    command: 'pnpm',
    args: [
      '--filter',
      '@openspecui/app',
      'exec',
      'vitest',
      'run',
      'src/routes/realtime-loading-surfaces.test.tsx',
      'src/app-router.test.tsx',
      'src/lib/use-store-data.test.tsx',
      'src/lib/connection-observation.test.ts',
    ],
    cwd: repositoryRoot,
  })
  await runCommand({
    command: 'pnpm',
    args: [
      '--filter',
      '@openspecui/web',
      'exec',
      'vitest',
      'run',
      '--project',
      'unit',
      'src/lib/use-dashboard.test.ts',
      'src/routes/dashboard.test.tsx',
      'src/routes/settings.test.tsx',
    ],
    cwd: repositoryRoot,
  })
}

await walkthroughYargs(hideWalkthroughBin(process.argv))
  .scriptName('run.sh.ts')
  .option('lab', {
    type: 'string',
    default: defaultLabDirectory,
    describe: 'Absolute or relative disposable lab directory.',
  })
  .command(
    'app',
    'Run the App dev surface in this foreground terminal.',
    () => {},
    async (argv) => startApp(String(argv.lab))
  )
  .command(
    'backend <id>',
    'Run backend A or B with generated Access Gate credentials.',
    (command) => command.positional('id', { choices: ['a', 'b'] as const }),
    async (argv) => startBackend(String(argv.lab), String(argv.id))
  )
  .command(
    'open <id>',
    'Open an exact missing- or invalid-credential Project Web acceptance page.',
    (command) =>
      command
        .positional('id', { choices: ['a', 'b'] as const })
        .option('credential', {
          choices: ['missing', 'invalid'] as const,
          default: 'missing' as const,
        })
        .option('print-only', {
          type: 'boolean',
          default: false,
          describe: 'Print the URL without invoking macOS open.',
        }),
    async (argv) =>
      openPage({
        labDirectory: String(argv.lab),
        rawId: String(argv.id),
        credential: argv.credential,
        printOnly: Boolean(argv.printOnly),
      })
  )
  .command(
    'status',
    'Print App/backend reachability without consuming credentials.',
    () => {},
    async (argv) => status(String(argv.lab))
  )
  .command(
    'benchmark [id]',
    'Run one isolated live-projection benchmark scenario.',
    (command) =>
      command
        .positional('id', { default: 'a', choices: ['a', 'b'] as const })
        .option('scenario', {
          choices: [
            'all',
            'transport',
            'dashboard',
            'dashboard-page',
            'config',
            'status',
            'changes',
            'changes-page',
          ] as const,
          default: 'dashboard-page' as const,
        })
        .option('timeout', { type: 'number', default: 30_000 }),
    async (argv) =>
      benchmark({
        labDirectory: String(argv.lab),
        rawId: String(argv.id),
        scenario: argv.scenario,
        timeout: Number(argv.timeout),
      })
  )
  .command(
    'verify',
    'Run focused App/Web Vitest evidence; this is not final browser acceptance.',
    () => {},
    verifyFocused
  )
  .strict()
  .demandCommand(1)
  .help()
  .parse()
