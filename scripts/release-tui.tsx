#!/usr/bin/env bun

import process from 'node:process'

import { createReleaseStepDefinitions } from './lib/release/plan'
import {
  createReleaseCommands,
  runLoggedCommand,
  runReleasePreflight,
  waitForNpmVersion,
} from './lib/release/runtime'
import { formatReleaseOverviewLines, formatReleaseStepStatus } from './lib/release/summary'
import type { ReleasePlan, ReleaseStepId, ReleaseStepStatus } from './lib/release/types'
import { loadReleasePlan } from './lib/release/workspace'

type StepStatusMap = Map<ReleaseStepId, ReleaseStepStatus>

function printLines(lines: readonly string[]): void {
  for (const line of lines) {
    console.log(line)
  }
}

function printSection(title: string): void {
  console.log(`\n== ${title} ==`)
}

function buildStepStatuses(plan: ReleasePlan, statuses?: StepStatusMap): StepStatusMap {
  const next = new Map<ReleaseStepId, ReleaseStepStatus>()
  for (const step of createReleaseStepDefinitions(plan)) {
    next.set(step.id, statuses?.get(step.id) ?? 'pending')
  }
  return next
}

function printOverview(plan: ReleasePlan, statuses: StepStatusMap, error: string | null): void {
  printSection('Release Plan')
  printLines(formatReleaseOverviewLines(plan, buildStepStatuses(plan, statuses), error))
}

async function runStepById(
  cwd: string,
  plan: ReleasePlan,
  stepId: ReleaseStepId,
  appendLog: (line: string) => void
): Promise<void> {
  const commands = createReleaseCommands(cwd)

  switch (stepId) {
    case 'preflight':
      await runReleasePreflight(cwd, plan, appendLog)
      return
    case 'publish-packages':
      await runLoggedCommand(commands.publishPackages, appendLog)
      return
    case 'wait-npm':
      await waitForNpmVersion('openspecui', plan.currentVersion, appendLog)
      return
    case 'build-app':
      await runLoggedCommand(commands.buildApp, appendLog)
      return
    case 'deploy-website':
      await runLoggedCommand(commands.deployWebsite, appendLog)
      return
    case 'deploy-app':
      await runLoggedCommand(commands.deployApp, appendLog)
      return
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd()
  const plan = loadReleasePlan(cwd)
  const steps = createReleaseStepDefinitions(plan)
  const statuses = buildStepStatuses(plan)

  console.log('OpenSpec UI Release Orchestrator')
  printOverview(plan, statuses, null)

  for (const [index, step] of steps.entries()) {
    if (step.skipReason) {
      statuses.set(step.id, 'skipped')
      printSection(
        `Step ${index + 1}/${steps.length} · ${step.title} · ${formatReleaseStepStatus('skipped')}`
      )
      console.log(step.description)
      console.log(`reason: ${step.skipReason}`)
      continue
    }

    statuses.set(step.id, 'running')
    printSection(`Step ${index + 1}/${steps.length} · ${step.title}`)
    console.log(step.description)

    try {
      await runStepById(cwd, plan, step.id, (line) => {
        console.log(line)
      })
      statuses.set(step.id, 'success')
      console.log(`${step.title}: ${formatReleaseStepStatus('success')}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      statuses.set(step.id, 'failed')
      console.error(`${step.title}: ${formatReleaseStepStatus('failed')}`)
      console.error(message)
      printOverview(plan, statuses, message)
      process.exitCode = 1
      return
    }
  }

  printSection('Release Summary')
  printLines(formatReleaseOverviewLines(plan, statuses, null))
  console.log('Release flow completed.')
}

await main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('Failed to run release orchestrator.')
  console.error(message)
  process.exitCode = 1
})
