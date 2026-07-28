/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Trigger Project config, Project Spec, and shared Store invalidations independently.
 * 2. Restore deterministic valid fixtures after repeated walkthrough mutations.
 * 3. Report mutation-source timestamps without interpreting browser acceptance.
 *
 * Original request (2026-07-27): "现在你辅助我完成走查，我需要一套脚本（你直接放在change文件夹中）来辅助我完成走查所需的命令执行工具"
 * Original request (2026-07-28): "我需要非常具体的验收工具和验收流程"
 */
import { appendFile, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  defaultLabDirectory,
  hideWalkthroughBin,
  projectConfig,
  projectConfigPath,
  projectSpecPath,
  referenceSpecPath,
  requirePreparedLab,
  resolveLab,
  responsiveSpecPath,
  sampleSpec,
  targetFor,
  walkthroughYargs,
  type WalkthroughLab,
} from './shared.ts'

async function writeFixture(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

async function appendInvalidation(path: string, kind: 'yaml' | 'markdown'): Promise<void> {
  const stamp = new Date().toISOString()
  const line =
    kind === 'yaml'
      ? `# walkthrough invalidation ${stamp}\n`
      : `<!-- walkthrough invalidation ${stamp} -->\n`
  await appendFile(path, line, 'utf8')
  console.log(`Mutated ${path}`)
}

async function reset(lab: WalkthroughLab): Promise<void> {
  await requirePreparedLab(lab)
  await Promise.all([
    ...Object.values(lab.targets).flatMap((target) => [
      writeFixture(projectConfigPath(target), projectConfig()),
      writeFixture(projectSpecPath(target), sampleSpec(`Project ${target.id.toUpperCase()}`)),
    ]),
    writeFixture(referenceSpecPath(lab), sampleSpec('Shared Reference')),
    writeFixture(responsiveSpecPath(lab), sampleSpec('Responsive Containment Evidence')),
  ])
  console.log('Restored deterministic Project and Store fixtures.')
}

async function reportStatus(lab: WalkthroughLab): Promise<void> {
  await requirePreparedLab(lab)
  const paths = [
    ...Object.values(lab.targets).flatMap((target) => [
      projectConfigPath(target),
      projectSpecPath(target),
    ]),
    referenceSpecPath(lab),
    responsiveSpecPath(lab),
  ]
  for (const path of paths) {
    const metadata = await stat(path)
    console.log(`${metadata.mtime.toISOString()}  ${path}`)
  }
}

await walkthroughYargs(hideWalkthroughBin(process.argv))
  .scriptName('mutate.sh.ts')
  .option('lab', {
    type: 'string',
    default: defaultLabDirectory,
    describe: 'Absolute or relative disposable lab directory.',
  })
  .command(
    'config <id>',
    'Append a valid YAML comment to Project A or B config.',
    (command) => command.positional('id', { choices: ['a', 'b'] as const }),
    async (argv) => {
      const lab = resolveLab(String(argv.lab))
      await requirePreparedLab(lab)
      await appendInvalidation(projectConfigPath(targetFor(lab, String(argv.id))), 'yaml')
    }
  )
  .command(
    'spec <id>',
    'Append a valid Markdown comment to Project A or B Spec.',
    (command) => command.positional('id', { choices: ['a', 'b'] as const }),
    async (argv) => {
      const lab = resolveLab(String(argv.lab))
      await requirePreparedLab(lab)
      await appendInvalidation(projectSpecPath(targetFor(lab, String(argv.id))), 'markdown')
    }
  )
  .command(
    'store',
    'Append a valid Markdown comment to the shared Reference Store Spec.',
    () => {},
    async (argv) => {
      const lab = resolveLab(String(argv.lab))
      await requirePreparedLab(lab)
      await appendInvalidation(referenceSpecPath(lab), 'markdown')
    }
  )
  .command(
    'reset',
    'Restore all generated configs and Specs to their deterministic baseline.',
    () => {},
    async (argv) => reset(resolveLab(String(argv.lab)))
  )
  .command(
    'status',
    'Print current mutation-source mtimes without changing the lab.',
    () => {},
    async (argv) => reportStatus(resolveLab(String(argv.lab)))
  )
  .strict()
  .demandCommand(1)
  .help()
  .parse()
