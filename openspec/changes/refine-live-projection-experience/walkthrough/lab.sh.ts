/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Prepare and reset a disposable two-project App/Web walkthrough lab.
 * 2. Seed a shared Store and valid OpenSpec facts for retained-projection exercises.
 * 3. Delete only a marker-owned lab on explicit clean/reset commands.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 */
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  defaultLabDirectory,
  ensureDirectory,
  hideWalkthroughBin,
  labMarkerKind,
  markerPath,
  pathExists,
  projectConfig,
  projectConfigPath,
  projectSpecPath,
  referenceSpecPath,
  referenceStoreId,
  requirePreparedLab,
  resolveLab,
  runOpenSpec,
  sampleSpec,
  walkthroughYargs,
  type WalkthroughLab,
  type WalkthroughTarget,
} from './shared.ts'

async function writeFixture(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

async function initializeProject(lab: WalkthroughLab, target: WalkthroughTarget): Promise<void> {
  await runOpenSpec(['init', target.projectDir, '--tools', 'none'], {
    cwd: lab.root,
    dataHome: target.dataHome,
  })
  await writeFixture(projectConfigPath(target), projectConfig())
  await writeFixture(projectSpecPath(target), sampleSpec(`Project ${target.id.toUpperCase()}`))
}

async function clean(lab: WalkthroughLab): Promise<void> {
  await requirePreparedLab(lab)
  await rm(lab.root, { recursive: true, force: false })
  console.log(`Removed walkthrough lab: ${lab.root}`)
}

async function prepare(lab: WalkthroughLab, reset: boolean): Promise<void> {
  if (await pathExists(lab.root)) {
    if (!reset) {
      throw new Error(
        `Lab ${lab.root} already exists. Use prepare --reset only when it is disposable.`
      )
    }
    await clean(lab)
  }

  await ensureDirectory(lab.root)
  await writeFile(
    markerPath(lab),
    `${JSON.stringify({ kind: labMarkerKind, version: 1 }, null, 2)}\n`,
    'utf8'
  )
  await Promise.all([ensureDirectory(lab.dataHome), ensureDirectory(lab.referenceStoreDir)])

  await runOpenSpec(
    [
      'store',
      'setup',
      referenceStoreId,
      '--path',
      lab.referenceStoreDir,
      '--no-init-git',
      '--json',
    ],
    { cwd: lab.root, dataHome: lab.dataHome }
  )
  await writeFixture(referenceSpecPath(lab), sampleSpec('Shared Reference'))
  await Promise.all(Object.values(lab.targets).map((target) => initializeProject(lab, target)))

  for (const target of Object.values(lab.targets)) {
    await runOpenSpec(['doctor', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
    await runOpenSpec(['context', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
  }

  console.log(`\nPrepared walkthrough lab: ${lab.root}`)
  console.log(`App: ${lab.appUrl}`)
  console.log('Start the App and both backends in three foreground terminals.')
}

function describe(lab: WalkthroughLab): void {
  console.log(
    JSON.stringify(
      {
        lab: lab.root,
        app: lab.appUrl,
        dataHome: lab.dataHome,
        referenceStore: { id: referenceStoreId, root: lab.referenceStoreDir },
        targets: lab.targets,
      },
      null,
      2
    )
  )
}

await walkthroughYargs(hideWalkthroughBin(process.argv))
  .scriptName('lab.sh.ts')
  .option('lab', {
    type: 'string',
    default: defaultLabDirectory,
    describe: 'Absolute or relative disposable lab directory.',
  })
  .command(
    'prepare',
    'Create the two-project live-projection lab.',
    (command) => command.option('reset', { type: 'boolean', default: false }),
    async (argv) => prepare(resolveLab(String(argv.lab)), Boolean(argv.reset))
  )
  .command(
    'describe',
    'Print paths, ports, and Store topology without changing the lab.',
    () => {},
    (argv) => describe(resolveLab(String(argv.lab)))
  )
  .command(
    'clean',
    'Remove only a prepared marker-owned lab.',
    () => {},
    async (argv) => clean(resolveLab(String(argv.lab)))
  )
  .strict()
  .demandCommand(1)
  .help()
  .parse()
