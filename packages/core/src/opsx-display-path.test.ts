import { describe, expect, it } from 'vitest'
import { toOpsxDisplayPath } from './opsx-display-path.js'

describe('toOpsxDisplayPath', () => {
  it('maps project-local absolute path to virtual project path', () => {
    const projectDir = '/Users/test/repo'
    const absolute = '/Users/test/repo/openspec/schemas/qaq/templates/tasks.md'
    expect(
      toOpsxDisplayPath(absolute, {
        projectDir,
        source: 'project',
      })
    ).toBe('project:openspec/schemas/qaq/templates/tasks.md')
  })

  it('maps package path to npm specifier', () => {
    const absolute =
      '/Users/test/.bun/install/global/node_modules/@fission-ai/openspec/schemas/spec-driven'
    expect(
      toOpsxDisplayPath(absolute, {
        source: 'package',
      })
    ).toBe('npm:@fission-ai/openspec/schemas/spec-driven')
  })

  it('maps pnpm virtual store node_modules path to npm specifier', () => {
    const absolute =
      '/repo/node_modules/.pnpm/@fission-ai+openspec@0.16.0/node_modules/@fission-ai/openspec/schemas/spec-driven/templates/spec.md'
    expect(
      toOpsxDisplayPath(absolute, {
        source: 'package',
      })
    ).toBe('npm:@fission-ai/openspec/schemas/spec-driven/templates/spec.md')
  })
})
