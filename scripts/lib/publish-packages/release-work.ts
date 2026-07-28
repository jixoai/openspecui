/**
 * Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
 * 1. Separate registry publication work from tag recovery work.
 * 2. Preserve package facts in an idempotent release plan.
 *
 * Original request (2026-07-28): "我想先发布一个beta版本"
 */

export type PackageReleaseFact<TPackage> = {
  package: TPackage
  tagExists: boolean
  versionPublished: boolean
}

export type PackageReleaseWork<TPackage> = {
  missingTags: TPackage[]
  packagesToPublish: TPackage[]
  required: boolean
}

export function createPackageReleaseWork<TPackage>(
  facts: readonly PackageReleaseFact<TPackage>[]
): PackageReleaseWork<TPackage> {
  const packagesToPublish = facts
    .filter((fact) => !fact.versionPublished)
    .map((fact) => fact.package)
  const missingTags = facts.filter((fact) => !fact.tagExists).map((fact) => fact.package)

  return {
    missingTags,
    packagesToPublish,
    required: packagesToPublish.length > 0 || missingTags.length > 0,
  }
}
