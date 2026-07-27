/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Run exact Store, Doctor, and Context commands against the disposable lab.
 * 2. Restore the shared mutation Store only through the pinned OpenSpec CLI registry surface.
 * 3. Run the Reference-bearing static export required by the final walkthrough.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 */
import { join, resolve } from 'node:path'
import { hideBin } from '../../../../packages/cli/node_modules/yargs/helpers/helpers.mjs'
import yargs from '../../../../packages/cli/node_modules/yargs/index.mjs'
import {
  defaultLabDirectory,
  openSpecEnvironment,
  repositoryRoot,
  requirePreparedLab,
  resolveLab,
  runCommand,
  runOpenSpec,
  targetFor,
} from './shared.ts'

const mutationStoreId = 'mutation-store'

async function inspectContext(labDirectory: string, rawId: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  const target = targetFor(lab, rawId)
  await runOpenSpec(['doctor', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
  await runOpenSpec(['context', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
}

async function inspectStores(labDirectory: string, scope: 'shared' | 'distinct'): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  const target = scope === 'shared' ? lab.targets.a : lab.targets.c
  await runOpenSpec(['store', 'list', '--json'], {
    cwd: target.projectDir,
    dataHome: target.dataHome,
  })
  await runOpenSpec(['store', 'doctor', '--json'], {
    cwd: target.projectDir,
    dataHome: target.dataHome,
  })
}

async function restoreMutationStore(labDirectory: string): Promise<void> {
  const lab = resolveLab(labDirectory)
  await requirePreparedLab(lab)
  const root = join(lab.root, 'stores', mutationStoreId)
  await runOpenSpec(['store', 'register', root, '--id', mutationStoreId, '--yes', '--json'], {
    cwd: lab.root,
    dataHome: lab.targets.a.dataHome,
  })
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

await yargs(hideBin(process.argv))
  .scriptName('inspect.sh.ts')
  .option('lab', {
    type: 'string',
    default: defaultLabDirectory,
    describe: 'Absolute or relative disposable lab directory.',
  })
  .command(
    'context <id>',
    'Run pinned Doctor and Context JSON for A, B, or C.',
    () => {},
    async (argv) => inspectContext(String(argv.lab), String(argv.id))
  )
  .command(
    'stores <scope>',
    'Run Store list and all-Store Doctor for shared or distinct data homes.',
    (command) => command.positional('scope', { choices: ['shared', 'distinct'] as const }),
    async (argv) => inspectStores(String(argv.lab), argv.scope)
  )
  .command(
    'restore-mutation-store',
    'Register the disposable shared mutation-store again after the UI removes it.',
    () => {},
    async (argv) => restoreMutationStore(String(argv.lab))
  )
  .command(
    'export-static [id]',
    'Export a Reference-bearing static project, optionally opening the result.',
    (command) =>
      command
        .positional('id', { default: 'a', choices: ['a', 'b', 'c'] as const })
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
