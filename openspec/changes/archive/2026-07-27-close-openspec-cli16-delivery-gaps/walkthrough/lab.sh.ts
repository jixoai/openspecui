/**
 * Orthogonal intents (created 2026-07-27 Asia/Shanghai):
 * 1. Create and reset the disposable three-project OpenSpec 1.6 walkthrough lab.
 * 2. Seed Store, Reference, and static-export facts required by checkpoints 6.7-6.12.
 * 3. Restore the shared mutation Store after destructive manual exercises.
 * 4. Delete only a marker-owned disposable lab on explicit clean/reset commands.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 */
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { hideBin } from '../../../../packages/cli/node_modules/yargs/helpers/helpers.mjs'
import yargs from '../../../../packages/cli/node_modules/yargs/index.mjs'
import {
  defaultLabDirectory,
  ensureDirectory,
  labMarkerName,
  markerPath,
  parentDirectory,
  pathExists,
  requirePreparedLab,
  resolveLab,
  runOpenSpec,
  writeText,
  type WalkthroughLab,
} from './shared.ts'

const sharedReferenceStoreId = 'shared-reference'
const distinctReferenceStoreId = 'distinct-reference'
const mutationStoreId = 'mutation-store'

function projectConfig(referenceStoreId: string): string {
  return ['schema: spec-driven', 'references:', `  - ${referenceStoreId}`, ''].join('\n')
}

function sampleSpec(title: string, requirement: string): string {
  return [
    `# ${title} Specification`,
    '',
    '## Purpose',
    '',
    `Disposable walkthrough fixture for ${title}.`,
    '',
    '## Requirements',
    '',
    `### Requirement: ${title} is visible`,
    '',
    `The system SHALL expose ${requirement}.`,
    '',
    '#### Scenario: Fixture opens',
    '',
    '- **WHEN** the walkthrough project is projected',
    `- **THEN** ${requirement} is available`,
    '',
  ].join('\n')
}

async function writeFixtureSpec(input: {
  root: string
  id: string
  title: string
  requirement: string
}): Promise<void> {
  const path = join(input.root, 'openspec', 'specs', input.id, 'spec.md')
  await mkdir(parentDirectory(path), { recursive: true })
  await writeText(path, sampleSpec(input.title, input.requirement))
}

async function initializeProject(input: {
  lab: WalkthroughLab
  id: 'a' | 'b' | 'c'
  referenceStoreId: string
}): Promise<void> {
  const target = input.lab.targets[input.id]
  await runOpenSpec(['init', target.projectDir, '--tools', 'none'], {
    cwd: input.lab.root,
    dataHome: target.dataHome,
  })
  await writeText(
    join(target.projectDir, 'openspec', 'config.yaml'),
    projectConfig(input.referenceStoreId)
  )
  await writeFixtureSpec({
    root: target.projectDir,
    id: `project-${input.id}-fixture`,
    title: `Project ${input.id.toUpperCase()} Fixture`,
    requirement: `the Project ${input.id.toUpperCase()} walkthrough fixture`,
  })
}

async function setupStore(input: {
  id: string
  root: string
  dataHome: string
  labRoot: string
}): Promise<void> {
  await runOpenSpec(['store', 'setup', input.id, '--path', input.root, '--no-init-git', '--json'], {
    cwd: input.labRoot,
    dataHome: input.dataHome,
  })
}

async function ensureMutationStore(lab: WalkthroughLab): Promise<void> {
  const storeRoot = join(lab.root, 'stores', mutationStoreId)
  const sharedDataHome = lab.targets.a.dataHome
  if (!(await pathExists(storeRoot))) {
    await setupStore({
      id: mutationStoreId,
      root: storeRoot,
      dataHome: sharedDataHome,
      labRoot: lab.root,
    })
    return
  }
  await runOpenSpec(['store', 'register', storeRoot, '--id', mutationStoreId, '--yes', '--json'], {
    cwd: lab.root,
    dataHome: sharedDataHome,
  })
}

async function prepare(lab: WalkthroughLab, reset: boolean): Promise<void> {
  const marker = markerPath(lab)
  if (await pathExists(lab.root)) {
    if (!reset) {
      throw new Error(
        `Lab ${lab.root} already exists. Use prepare --reset only after confirming it is disposable.`
      )
    }
    await clean(lab)
  }

  await mkdir(lab.root, { recursive: true })
  await writeText(
    marker,
    `${JSON.stringify({ kind: 'openspecui-cli16-walkthrough', version: 1 }, null, 2)}\n`
  )
  await Promise.all([
    ensureDirectory(lab.targets.a.dataHome),
    ensureDirectory(lab.targets.c.dataHome),
    ensureDirectory(join(lab.root, 'stores')),
  ])

  await setupStore({
    id: sharedReferenceStoreId,
    root: join(lab.root, 'stores', sharedReferenceStoreId),
    dataHome: lab.targets.a.dataHome,
    labRoot: lab.root,
  })
  await setupStore({
    id: distinctReferenceStoreId,
    root: join(lab.root, 'stores', distinctReferenceStoreId),
    dataHome: lab.targets.c.dataHome,
    labRoot: lab.root,
  })
  await ensureMutationStore(lab)
  await writeFixtureSpec({
    root: join(lab.root, 'stores', sharedReferenceStoreId),
    id: 'shared-contract',
    title: 'Shared Contract',
    requirement: 'the shared Reference contract',
  })
  await writeFixtureSpec({
    root: join(lab.root, 'stores', distinctReferenceStoreId),
    id: 'distinct-contract',
    title: 'Distinct Contract',
    requirement: 'the distinct Reference contract',
  })

  await initializeProject({ lab, id: 'a', referenceStoreId: sharedReferenceStoreId })
  await initializeProject({ lab, id: 'b', referenceStoreId: sharedReferenceStoreId })
  await initializeProject({ lab, id: 'c', referenceStoreId: distinctReferenceStoreId })

  for (const target of Object.values(lab.targets)) {
    await runOpenSpec(['doctor', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
    await runOpenSpec(['context', '--json'], { cwd: target.projectDir, dataHome: target.dataHome })
  }

  console.log(`\nPrepared walkthrough lab: ${lab.root}`)
  console.log(`App: ${lab.appUrl}`)
  console.log('Use run.sh.ts app and three separate run.sh.ts backend commands next.')
}

async function clean(lab: WalkthroughLab): Promise<void> {
  const marker = Bun.file(markerPath(lab))
  if (!(await marker.exists())) {
    throw new Error(`Refusing to remove ${lab.root}: ${labMarkerName} is absent.`)
  }
  const value: unknown = await marker.json()
  if (
    !value ||
    typeof value !== 'object' ||
    !('kind' in value) ||
    value.kind !== 'openspecui-cli16-walkthrough'
  ) {
    throw new Error(`Refusing to remove ${lab.root}: ${labMarkerName} is not a walkthrough marker.`)
  }
  await rm(lab.root, { recursive: true, force: false })
  console.log(`Removed walkthrough lab: ${lab.root}`)
}

function describe(lab: WalkthroughLab): void {
  console.log(
    JSON.stringify(
      {
        lab: lab.root,
        app: lab.appUrl,
        sharedDataHome: lab.targets.a.dataHome,
        distinctDataHome: lab.targets.c.dataHome,
        targets: lab.targets,
        stores: {
          sharedReferenceStoreId,
          distinctReferenceStoreId,
          mutationStoreId,
        },
      },
      null,
      2
    )
  )
}

await yargs(hideBin(process.argv))
  .scriptName('lab.sh.ts')
  .option('lab', {
    type: 'string',
    default: defaultLabDirectory,
    describe: 'Absolute or relative disposable lab directory.',
  })
  .command(
    'prepare',
    'Create the disposable A/B/C walkthrough lab.',
    (command) => command.option('reset', { type: 'boolean', default: false }),
    async (argv) => prepare(resolveLab(String(argv.lab)), Boolean(argv.reset))
  )
  .command(
    'restore-mutation-store',
    'Register mutation-store again after an unregister/remove exercise.',
    () => {},
    async (argv) => {
      const lab = resolveLab(String(argv.lab))
      await requirePreparedLab(lab)
      await ensureMutationStore(lab)
    }
  )
  .command(
    'describe',
    'Print the deterministic lab paths, URLs, and Store identities.',
    () => {},
    (argv) => describe(resolveLab(String(argv.lab)))
  )
  .command(
    'clean',
    'Remove only a marker-owned disposable walkthrough lab.',
    () => {},
    async (argv) => clean(resolveLab(String(argv.lab)))
  )
  .strict()
  .demandCommand(1)
  .help()
  .parse()
