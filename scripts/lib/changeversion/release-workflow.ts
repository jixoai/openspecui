import { spawnSync } from 'node:child_process'

const POLL_INTERVAL_MS = 5000

type CaptureRunResult = {
  status: number
  stdout: string
  stderr: string
}

export type InheritRunResult = {
  status: number
  timedOut: boolean
}

type WorkflowRunListEntry = {
  conclusion: string | null
  databaseId: number
  headSha: string
  status: string
  url: string
  workflowName?: string
}

function commandForGh(): string {
  return process.platform === 'win32' ? 'gh.exe' : 'gh'
}

function runCaptureResult(args: string[]): CaptureRunResult {
  const result = spawnSync(commandForGh(), args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  }
}

function runInherit(args: string[], timeoutMs?: number): InheritRunResult {
  const result = spawnSync(commandForGh(), args, {
    stdio: 'inherit',
    timeout: timeoutMs,
  })
  const timedOut =
    result.error?.name === 'Error' && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
  return {
    status: result.status ?? 1,
    timedOut,
  }
}

function sleepMs(ms: number): void {
  const lock = new Int32Array(new SharedArrayBuffer(4))
  Atomics.wait(lock, 0, 0, ms)
}

function listWorkflowRuns(
  workflowFile: string,
  branch: string,
  commitSha: string
): WorkflowRunListEntry[] {
  const result = runCaptureResult([
    'run',
    'list',
    '--workflow',
    workflowFile,
    '--branch',
    branch,
    '--commit',
    commitSha,
    '--event',
    'push',
    '--limit',
    '5',
    '--json',
    'conclusion,databaseId,headSha,status,url,workflowName',
  ])
  if (result.status !== 0) {
    const detail = result.stderr || result.stdout || `gh run list failed for ${workflowFile}`
    throw new Error(detail)
  }

  const parsed = JSON.parse(result.stdout) as WorkflowRunListEntry[]
  return parsed.filter((run) => run.headSha === commitSha)
}

export function waitForWorkflowRunToAppear(
  workflowFile: string,
  branch: string,
  commitSha: string,
  timeoutMs: number
): WorkflowRunListEntry {
  const deadlineMs = Date.now() + timeoutMs

  while (Date.now() < deadlineMs) {
    const [run] = listWorkflowRuns(workflowFile, branch, commitSha)
    if (run) {
      return run
    }
    sleepMs(POLL_INTERVAL_MS)
  }

  throw new Error(
    `Timed out waiting for workflow '${workflowFile}' on ${branch} at commit ${commitSha}.`
  )
}

export function watchWorkflowRun(runId: number, timeoutMs: number): InheritRunResult {
  return runInherit(['run', 'watch', String(runId), '--exit-status', '--interval', '10'], timeoutMs)
}
