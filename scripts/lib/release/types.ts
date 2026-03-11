export type ReleaseDecision = {
  reason: string
  required: boolean
}

export type ReleasePlanInput = {
  baselineCommit: string | null
  changedFiles: string[]
  currentVersion: string
  headCommit: string
  previousVersion: string | null
}

export type ReleasePlan = {
  app: ReleaseDecision
  baselineCommit: string | null
  changedFiles: string[]
  currentVersion: string
  headCommit: string
  previousVersion: string | null
  waitForNpm: ReleaseDecision
  website: ReleaseDecision
}

export type ReleaseStepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export type ReleaseStepId =
  | 'preflight'
  | 'publish-packages'
  | 'wait-npm'
  | 'build-app'
  | 'deploy-website'
  | 'deploy-app'

export type ReleaseStepDefinition = {
  description: string
  id: ReleaseStepId
  skipReason?: string
  title: string
}
