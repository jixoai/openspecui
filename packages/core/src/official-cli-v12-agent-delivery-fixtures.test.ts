/**
 * Orthogonal intents (created 2026-09-03 Asia/Shanghai):
 * 1. Execute the pinned OpenSpec 1.12.0 SourceCraft Code Assistant delivery contract
 *    against an isolated machine environment: 6 skills + 6 commands under the default
 *    core profile with the physical `.codeassistant` layout.
 * 2. Prove init anchors empty directories with `.gitkeep`, restores missing anchors on
 *    re-init, and never overwrites existing files or anchors non-empty directories.
 * 3. Prove the shared IDE restart hint wording: qoder prints it, codeassistant does not.
 *
 * Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
 */
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  createPinnedFixtureRoot,
  expectPinnedVersion,
  PINNED_OPENSPEC_V12_VERSIONS,
  pinnedFixtureEnv,
  removePinnedFixtureRoot,
  runPinnedOpenspec,
} from './__tests__/official-cli-v12-fixtures.js'

/** The default core profile selects exactly these six workflows. */
const CORE_PROFILE_SKILLS = [
  'openspec-apply-change',
  'openspec-archive-change',
  'openspec-explore',
  'openspec-propose',
  'openspec-sync-specs',
  'openspec-update-change',
] as const

const CORE_PROFILE_COMMANDS = [
  'opsx-apply',
  'opsx-archive',
  'opsx-explore',
  'opsx-propose',
  'opsx-sync',
  'opsx-update',
] as const

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

describe('pinned OpenSpec 1.12 Agent delivery fixtures', () => {
  let fixtureRoot: string | null = null

  afterEach(async () => {
    await removePinnedFixtureRoot(fixtureRoot)
    fixtureRoot = null
  })

  for (const version of PINNED_OPENSPEC_V12_VERSIONS) {
    it(`delivers six skills and six commands to .codeassistant under the default core profile on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-codeassistant`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      await expectPinnedVersion(version, project, env)

      // Both XDG_CONFIG_HOME and XDG_DATA_HOME stay inside the fixture root: a leaked
      // machine-global profile would change the artifact counts.
      const result = await runPinnedOpenspec(
        version,
        ['init', project, '--tools', 'codeassistant'],
        project,
        env
      )
      expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
      expect(result.stdout).toContain('6 skills and 6 commands in .codeassistant/')
      // codeassistant is not IDE-resident: no restart hint is printed.
      expect(result.stdout).not.toContain('Restart your IDE')

      // Skills live at .codeassistant/skills/openspec-*/SKILL.md.
      const skillDirs = await readdir(join(project, '.codeassistant', 'skills'))
      expect([...skillDirs].sort()).toEqual([...CORE_PROFILE_SKILLS])
      for (const skill of CORE_PROFILE_SKILLS) {
        const skillPath = join(project, '.codeassistant', 'skills', skill, 'SKILL.md')
        expect(await pathExists(skillPath), skillPath).toBe(true)
      }

      // Commands live at .codeassistant/commands/opsx-*.md with YAML frontmatter.
      const commandFiles = await readdir(join(project, '.codeassistant', 'commands'))
      expect([...commandFiles].sort()).toEqual(
        CORE_PROFILE_COMMANDS.map((command) => `${command}.md`)
      )
      for (const command of CORE_PROFILE_COMMANDS) {
        const commandPath = join(project, '.codeassistant', 'commands', `${command}.md`)
        const content = await readFile(commandPath, 'utf8')
        expect(content.startsWith('---\ndescription:'), commandPath).toBe(true)
      }
    }, 60_000)

    it(`anchors empty openspec directories with .gitkeep and restores only missing anchors on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(
        `cli-${version.replace(/\./g, '')}-gitkeep-anchors`
      )
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      const initialized = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(initialized.exitCode, initialized.stdout + '\n' + initialized.stderr).toBe(0)

      // Fresh init anchors both empty directories.
      expect(await pathExists(join(project, 'openspec', 'specs', '.gitkeep'))).toBe(true)
      expect(await pathExists(join(project, 'openspec', 'changes', 'archive', '.gitkeep'))).toBe(
        true
      )

      // Re-init restores a deleted anchor when the directory is empty again.
      await rm(join(project, 'openspec', 'specs', '.gitkeep'))
      const reinited = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(reinited.exitCode, reinited.stdout + '\n' + reinited.stderr).toBe(0)
      expect(await pathExists(join(project, 'openspec', 'specs', '.gitkeep'))).toBe(true)

      // A non-empty directory is never (re-)anchored and existing files survive.
      await rm(join(project, 'openspec', 'changes', 'archive', '.gitkeep'))
      await writeFile(
        join(project, 'openspec', 'changes', 'archive', 'real.md'),
        'existing content\n'
      )
      const reanchored = await runPinnedOpenspec(
        version,
        ['init', project, '--tools=none'],
        project,
        env
      )
      expect(reanchored.exitCode, reanchored.stdout + '\n' + reanchored.stderr).toBe(0)
      expect(await pathExists(join(project, 'openspec', 'changes', 'archive', '.gitkeep'))).toBe(
        false
      )
      expect(
        await readFile(join(project, 'openspec', 'changes', 'archive', 'real.md'), 'utf8')
      ).toBe('existing content\n')
    }, 60_000)

    it(`prints the shared restart hint for qoder on OpenSpec ${version}`, async () => {
      fixtureRoot = await createPinnedFixtureRoot(`cli-${version.replace(/\./g, '')}-qoder-hint`)
      const project = join(fixtureRoot, 'project')
      const env = pinnedFixtureEnv(fixtureRoot)
      await mkdir(project, { recursive: true })

      const result = await runPinnedOpenspec(
        version,
        ['init', project, '--tools', 'qoder'],
        project,
        env
      )
      expect(result.exitCode, result.stdout + '\n' + result.stderr).toBe(0)
      // One shared module owns the wording for init and update.
      expect(result.stdout).toContain('Restart your IDE to refresh commands.')
    }, 60_000)
  }
})
