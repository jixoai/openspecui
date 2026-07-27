/**
 * Orthogonal intents (created 2026-07-15 Asia/Shanghai):
 * 1. Pin the official OpenSpec v1.4, v1.5, and v1.6 source contracts used by OpenSpecUI.
 * 2. Prevent a version-gate-only adaptation from masking missing workflow or root behavior.
 * 3. Keep validation, archive, task, and tool-delivery fixtures traceable to first-party source.
 *
 * Original request (2026-07-15): "1.4、1.5、1.6 第一方合同回归测试。"
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const upstreamRoot = resolve(repositoryRoot, 'references/openspec')

function readAtTag(tag: 'v1.4.1' | 'v1.5.0', path: string): string {
  return execFileSync('git', ['-C', upstreamRoot, 'show', `${tag}:${path}`], { encoding: 'utf8' })
}

function readPinned(path: string): string {
  return readFileSync(resolve(upstreamRoot, path), 'utf8')
}

describe('first-party OpenSpec 1.4-1.6 contracts', () => {
  it('locks sync into the 1.4 core profile', () => {
    const profiles = readAtTag('v1.4.1', 'src/core/profiles.ts')

    expect(profiles).toContain(
      "CORE_WORKFLOWS = ['propose', 'explore', 'apply', 'sync', 'archive']"
    )
  })

  it('locks the 1.5 root provenance and Store command family', () => {
    const rootSelection = readAtTag('v1.5.0', 'src/core/root-selection.ts')
    const stores = readAtTag('v1.5.0', 'src/commands/store.ts')

    expect(rootSelection).toContain('source: OpenSpecRootSource;')
    expect(rootSelection).toContain('store_id?: string;')
    expect(rootSelection).toContain("resolveStoreRoot(pointer.value, globalDataDir, 'declared')")
    expect(rootSelection).toContain('resolveStoreRoot(options.store, options.globalDataDir)')
    for (const command of ['setup', 'register', 'unregister', 'remove', 'list', 'doctor']) {
      expect(stores).toContain(`.command('${command}`)
    }
  })

  it('locks the pinned v1.6 update profile and tool command delivery', () => {
    const profiles = readPinned('src/core/profiles.ts')
    const skills = readPinned('src/core/shared/skill-generation.ts')
    const ohMyPi = readPinned('src/core/command-generation/adapters/oh-my-pi.ts')
    const trae = readPinned('src/core/command-generation/adapters/trae.ts')

    expect(profiles).toContain(
      "CORE_WORKFLOWS = ['propose', 'explore', 'apply', 'update', 'sync', 'archive']"
    )
    expect(skills).toContain("dirName: 'openspec-update-change', workflowId: 'update'")
    expect(ohMyPi).toContain("path.join('.omp', 'commands', `opsx-${commandId}.md`)")
    expect(trae).toContain("path.join('.trae', 'commands', `opsx-${commandId}.md`)")
  })

  it('locks the pinned v1.6 tracked-task, multiline, and archive safety fixes', () => {
    const taskProgress = readPinned('src/utils/task-progress.ts')
    const requirementText = readPinned('src/core/parsers/requirement-text.ts')
    const archive = readPinned('src/core/archive.ts')
    const specsApply = readPinned('src/core/specs-apply.ts')
    const rootInspection = readPinned('src/core/openspec-root.ts')

    expect(taskProgress).toContain('apply?.tracks')
    expect(taskProgress).toContain('resolveArtifactOutputs(changeDir, generates)')
    expect(requirementText).toContain('extractRequirementBody')
    expect(archive).toContain("'archive_spec_update_failed'")
    expect(specsApply).toContain(
      'current spec contains scenario(s) not present in the modified block'
    )
    expect(rootInspection).toContain('inspectOptionalPlanningDirectory')
  })

  it('pins the reference checkout to the official v1.6.0 commit', () => {
    const commit = execFileSync('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim()

    expect(commit).toBe('e1b51d111ab446b54dee2d6159ac245f0339ae52')
  })
})
