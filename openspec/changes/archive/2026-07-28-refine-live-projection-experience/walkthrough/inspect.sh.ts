/**
 * Orthogonal intents (created 2026-07-28 Asia/Shanghai):
 * 1. Print and restore pinned OpenSpec Store, Doctor, and Context facts for the disposable acceptance lab.
 * 2. Rebuild clean SSG artifacts and export one Reference-bearing static project.
 *
 * Original request (2026-07-28): "我需要非常具体的验收工具和验收流程"
 */
import { join, resolve } from 'node:path'
import {
  defaultLabDirectory,
  hideWalkthroughBin,
  openSpecEnvironment,
  repositoryRoot,
  requirePreparedLab,
  resolveLab,
  responsiveStoreId,
  runCommand,
  runOpenSpec,
  targetFor,
  walkthroughYargs,
} from './shared.ts'

async function inspectContext(labDirectory: string, rawId: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  const target = targetFor(lab, rawId)
  await runOpenSpec(['doctor', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
  await runOpenSpec(['context', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
}

async function inspectStores(labDirectory: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  await runOpenSpec(['store', 'list', '--json'], {
    cwd: lab.targets.a.projectDir,
    dataHome: lab.dataHome,
  })
  await runOpenSpec(['store', 'doctor', '--json'], {
    cwd: lab.targets.a.projectDir,
    dataHome: lab.dataHome,
  })
}

async function restoreResponsiveStore(labDirectory: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  await runOpenSpec(
    ['store', 'register', lab.responsiveStoreDir, '--id', responsiveStoreId, '--yes', '--json'],
    { cwd: lab.root, dataHome: lab.dataHome }
  )
}

async function exportStatic(input: {
  labDirectory: string
  rawId: string
  output?: string
  open: boolean
}): Promise<void> {
  const lab = resolveLab(input.labDirectory)
  await requirePreparedLab(lab)
  const target = targetFor(lab, input.rawId)
  const output = resolve(input.output ?? join(lab.root, `static-${target.id}`))
  await runCommand({
    command: 'pnpm',
    args: ['--filter', '@openspecui/web', 'build:ssg'],
    cwd: repositoryRoot,
  })
  const args = [
    'openspecui',
    '--',
    'export',
    '--dir',
    target.projectDir,
    '--format',
    'html',
    '--output',
    output,
    '--references',
    'include',
  ]
  if (input.open) args.push('--open')
  await runCommand({
    command: 'pnpm',
    args,
    cwd: repositoryRoot,
    env: openSpecEnvironment(target.dataHome),
  })
}

await walkthroughYargs(hideWalkthroughBin(process.argv))
  .scriptName('inspect.sh.ts')
  .option('lab', {
    type: 'string',
    default: defaultLabDirectory,
    describe: 'Absolute or relative disposable lab directory.',
  })
  .command(
    'context <id>',
    'Run pinned Doctor and Context JSON for Project A or B.',
    (command) => command.positional('id', { choices: ['a', 'b'] as const }),
    async (argv) => inspectContext(String(argv.lab), String(argv.id))
  )
  .command(
    'stores',
    'Run pinned Store list and all-Store Doctor against the isolated registry.',
    () => {},
    async (argv) => inspectStores(String(argv.lab))
  )
  .command(
    'restore-responsive-store',
    'Register the long responsive fixture again after the UI unregisters it.',
    () => {},
    async (argv) => restoreResponsiveStore(String(argv.lab))
  )
  .command(
    'export-static [id]',
    'Rebuild SSG and export one Reference-bearing static project.',
    (command) =>
      command
        .positional('id', { default: 'a', choices: ['a', 'b'] as const })
        .option('output', { type: 'string', describe: 'Static output directory.' })
        .option('open', { type: 'boolean', default: false }),
    async (argv) =>
      exportStatic({
        labDirectory: String(argv.lab),
        rawId: String(argv.id),
        output: argv.output,
        open: Boolean(argv.open),
      })
  )
  .strict()
  .demandCommand(1)
  .help()
  .parse()
