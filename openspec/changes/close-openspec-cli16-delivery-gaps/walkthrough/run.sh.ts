/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Start one App or Access-Gated backend in the operator's foreground terminal.
 * 2. Open missing/invalid credential pages needed by the Gate rejection walkthrough.
 * 3. Show unauthenticated endpoint reachability without consuming or recording generated credentials.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 */
import { hideBin } from '../../../../packages/cli/node_modules/yargs/helpers/helpers.mjs'
import yargs from '../../../../packages/cli/node_modules/yargs/index.mjs'
import {
  defaultLabDirectory,
  openSpecEnvironment,
  repositoryRoot,
  requirePreparedLab,
  resolveLab,
  runCommand,
  targetFor,
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
      {
        label: `Backend ${target.id.toUpperCase()} shell`,
        url: `http://127.0.0.1:${String(target.port)}`,
      },
      {
        label: `Backend ${target.id.toUpperCase()} protected health`,
        url: `http://127.0.0.1:${String(target.port)}/api/health`,
      },
    ]),
  ]
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, { redirect: 'manual' })
      console.log(`${endpoint.label}: HTTP ${String(response.status)}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.log(`${endpoint.label}: unavailable (${message})`)
    }
  }
  console.log('Protected health is expected to return 401 without an Authorization header.')
}

await yargs(hideBin(process.argv))
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
    'Run one Access-Gated backend in this foreground terminal.',
    () => {},
    async (argv) => startBackend(String(argv.lab), String(argv.id))
  )
  .command(
    'open <id>',
    'Open a missing- or invalid-credential backend page for checkpoint 6.8.',
    (command) =>
      command
        .option('credential', {
          choices: ['missing', 'invalid'] as const,
          default: 'missing' as const,
          describe: 'Credential state to put in the browser URL.',
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
    'Print App/backend reachability without credentials.',
    () => {},
    async (argv) => status(String(argv.lab))
  )
  .strict()
  .demandCommand(1)
  .help()
  .parse()
