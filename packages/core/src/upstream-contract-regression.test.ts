/**
 * Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
 * 1. Pin the official OpenSpec v1.4 through v1.9 source contracts used by OpenSpecUI.
 * 2. Prevent a version-gate-only adaptation from masking missing workflow or root behavior.
 * 3. Keep validation, archive, task, and tool-delivery fixtures traceable to first-party source.
 * 4. Hide fixture subprocess console windows (`windowsHide`) for uniform hidden-console execution on Windows.
 *
 * Original request (2026-08-14): "在Windows平台上，执行命令总是会弹出cmd窗口，这个可否统一隐藏，你先调查一下原因"
 * Original request (2026-07-15): "1.4、1.5、1.6 第一方合同回归测试。"
 * Original request (2026-08-01): adapt the complete OpenSpec 1.7 Agent delivery protocol for OpenSpecUI 7.
 * Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '../../..')
const upstreamRoot = resolve(repositoryRoot, 'references/openspec')

function readAtTag(tag: 'v1.4.1' | 'v1.5.0', path: string): string {
  return execFileSync('git', ['-C', upstreamRoot, 'show', `${tag}:${path}`], {
    encoding: 'utf8',
    windowsHide: true,
  })
}

function readPinned(path: string): string {
  return readFileSync(resolve(upstreamRoot, path), 'utf8')
}

describe('first-party OpenSpec 1.4-1.7 contracts', () => {
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

  it('preserves the v1.6 update profile and command delivery through the pinned v1.7 source', () => {
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

  it('preserves the v1.6 tracked-task, multiline, and archive safety fixes', () => {
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

  it('pins the reference checkout to the official v1.9.0 commit', () => {
    const commit = execFileSync('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      windowsHide: true,
    }).trim()

    expect(commit).toBe('2826b8889e5223a9a8095d4428b60b56597e1020')
  })

  it('locks the v1.8/v1.9 planning-completion, schemas sum type, and archived validation sources', () => {
    const instructionLoader = readPinned('src/core/artifact-graph/instruction-loader.ts')
    const schemas = readPinned('src/commands/workflow/schemas.ts')
    const rootSelection = readPinned('src/core/root-selection.ts')
    const validate = readPinned('src/commands/validate.ts')

    expect(instructionLoader).toContain('isPlanningComplete: isComplete,')
    expect(instructionLoader).toContain('/** Compatibility alias for isPlanningComplete */')
    expect(schemas).toContain('failurePayload: { schemas: [], root: null }')
    expect(rootSelection).toContain(
      '{ ...(output.failurePayload ?? {}), status: [error.diagnostic] }'
    )
    expect(validate).toContain('options.archived')
    expect(validate).toContain('incomplete task')
  })
})
