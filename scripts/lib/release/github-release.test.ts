import { describe, expect, it } from 'vitest'

import {
  extractChangelogSection,
  formatGithubReleaseNotes,
  getGithubReleaseTag,
  getGithubReleaseTitle,
} from './github-release'

describe('github release helpers', () => {
  it('extracts one version section without trailing versions', () => {
    const changelog = [
      '# openspecui',
      '',
      '## 3.11.0',
      '',
      '### Minor Changes',
      '',
      '- abc123: Add file preview platform.',
      '',
      '## 3.10.0',
      '',
      '### Minor Changes',
      '',
      '- older: Previous release.',
      '',
    ].join('\n')

    expect(extractChangelogSection(changelog, '3.11.0')).toBe(
      ['### Minor Changes', '', '- abc123: Add file preview platform.'].join('\n')
    )
  })

  it('returns null when the version is missing', () => {
    expect(extractChangelogSection('# openspecui\n', '9.9.9')).toBeNull()
  })

  it('formats release notes from changelog content with trailing newline', () => {
    expect(
      formatGithubReleaseNotes({
        packageName: 'openspecui',
        version: '3.11.0',
        changelogSection: '### Minor Changes\n\n- abc123: Add file preview platform.',
      })
    ).toBe('### Minor Changes\n\n- abc123: Add file preview platform.\n')
  })

  it('falls back to a generic body when changelog content is absent', () => {
    expect(
      formatGithubReleaseNotes({
        packageName: 'openspecui',
        version: '3.11.0',
        changelogSection: null,
      })
    ).toBe('Release openspecui 3.11.0.\n')
  })

  it('builds the canonical release tag and title', () => {
    expect(getGithubReleaseTag('openspecui', '3.11.0')).toBe('openspecui@3.11.0')
    expect(getGithubReleaseTitle('openspecui', '3.11.0')).toBe('openspecui 3.11.0')
  })
})
