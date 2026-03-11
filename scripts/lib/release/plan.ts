import type { ReleaseDecision, ReleasePlan, ReleasePlanInput, ReleaseStepDefinition } from './types'

export const RELEASE_COMMIT_MESSAGE = 'chore(release): apply changeset version'

const APP_PATHS = ['packages/app/']
const SHARED_WEB_PATHS = ['packages/web/src/']
const WEBSITE_PATHS = ['packages/website/']

function hasMatchingPath(changedFiles: string[], prefixes: readonly string[]): boolean {
  return changedFiles.some((file) => prefixes.some((prefix) => file.startsWith(prefix)))
}

function createDecision(required: boolean, reason: string): ReleaseDecision {
  return { required, reason }
}

export function parseReleaseCommitHashes(output: string): string[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function resolveBaselineReleaseCommit(
  releaseCommits: readonly string[],
  headCommit: string
): string | null {
  if (releaseCommits.length === 0) return null
  if (releaseCommits[0] === headCommit) {
    return releaseCommits[1] ?? null
  }
  return releaseCommits[0] ?? null
}

export function readPackageVersionFromJson(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

function getWebsiteDecision(input: ReleasePlanInput): ReleaseDecision {
  if (!input.baselineCommit) {
    return createDecision(
      true,
      'No previous release commit found, deploy website for the initial baseline.'
    )
  }
  if (hasMatchingPath(input.changedFiles, SHARED_WEB_PATHS)) {
    return createDecision(true, 'Shared web source changed, so website must be redeployed.')
  }
  if (hasMatchingPath(input.changedFiles, WEBSITE_PATHS)) {
    return createDecision(true, 'Website source changed since the previous release.')
  }
  return createDecision(
    false,
    'No website or shared web source changes since the previous release.'
  )
}

function getAppDecision(input: ReleasePlanInput): ReleaseDecision {
  if (!input.baselineCommit) {
    return createDecision(
      true,
      'No previous release commit found, deploy app for the initial baseline.'
    )
  }
  if (hasMatchingPath(input.changedFiles, SHARED_WEB_PATHS)) {
    return createDecision(true, 'Shared web source changed, so hosted app assets must be rebuilt.')
  }
  if (hasMatchingPath(input.changedFiles, APP_PATHS)) {
    return createDecision(true, 'Hosted app source changed since the previous release.')
  }
  if (input.previousVersion !== input.currentVersion) {
    return createDecision(
      true,
      'The published openspecui CLI version changed, so hosted channels must refresh.'
    )
  }
  return createDecision(
    false,
    'No app, shared web, or published CLI version changes since the previous release.'
  )
}

export function createReleasePlan(input: ReleasePlanInput): ReleasePlan {
  const website = getWebsiteDecision(input)
  const app = getAppDecision(input)
  const waitForNpm =
    app.required && input.previousVersion !== input.currentVersion
      ? createDecision(
          true,
          'App build depends on the newly published openspecui tarball becoming visible on npm.'
        )
      : createDecision(
          false,
          'App build does not depend on a newly published openspecui version in this release.'
        )

  return {
    app,
    baselineCommit: input.baselineCommit,
    changedFiles: [...input.changedFiles],
    currentVersion: input.currentVersion,
    headCommit: input.headCommit,
    previousVersion: input.previousVersion,
    waitForNpm,
    website,
  }
}

export function createReleaseStepDefinitions(plan: ReleasePlan): ReleaseStepDefinition[] {
  return [
    {
      id: 'preflight',
      title: 'Preflight',
      description: 'Verify git state, npm auth, and Cloudflare auth before publishing.',
    },
    {
      id: 'publish-packages',
      title: 'Publish Packages',
      description: 'Run the core build and publish workspace packages through Changesets.',
    },
    {
      id: 'wait-npm',
      title: 'Wait For npm',
      description: `Wait until openspecui@${plan.currentVersion} is visible on npm before hosted app build starts.`,
      skipReason: plan.waitForNpm.required ? undefined : plan.waitForNpm.reason,
    },
    {
      id: 'build-app',
      title: 'Build Hosted App',
      description: 'Build @openspecui/app after npm readiness so hosted channels can materialize.',
      skipReason: plan.app.required ? undefined : plan.app.reason,
    },
    {
      id: 'deploy-website',
      title: 'Deploy Website',
      description:
        'Deploy @openspecui/website to Cloudflare Pages when website-facing sources changed.',
      skipReason: plan.website.required ? undefined : plan.website.reason,
    },
    {
      id: 'deploy-app',
      title: 'Deploy Hosted App',
      description: 'Deploy @openspecui/app to Cloudflare Pages when hosted app sources changed.',
      skipReason: plan.app.required ? undefined : plan.app.reason,
    },
  ]
}
