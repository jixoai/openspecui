export function extractChangelogSection(changelog: string, version: string): string | null {
  const lines = changelog.split('\n')
  const header = `## ${version}`
  const startIndex = lines.findIndex((line) => line.trim() === header)
  if (startIndex === -1) return null

  let endIndex = lines.length
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (/^##\s+/.test(lines[index]!.trim())) {
      endIndex = index
      break
    }
  }

  return lines
    .slice(startIndex + 1, endIndex)
    .join('\n')
    .trim()
}

export function formatGithubReleaseNotes(input: {
  changelogSection: string | null
  packageName: string
  version: string
}): string {
  const section = input.changelogSection?.trim()
  if (section && section.length > 0) {
    return section.endsWith('\n') ? section : `${section}\n`
  }
  return `Release ${input.packageName} ${input.version}.\n`
}

export function getGithubReleaseTag(packageName: string, version: string): string {
  return `${packageName}@${version}`
}

export function getGithubReleaseTitle(packageName: string, version: string): string {
  return `${packageName} ${version}`
}
