#!/usr/bin/env bun
/** @jsxImportSource @opentui/react */

import {
  createCliRenderer,
  RGBA,
  StyledText,
  type TabSelectOption,
  type TabSelectRenderable,
  type TextChunk,
} from '@opentui/core'
import { createRoot, useKeyboard, useRenderer } from '@opentui/react'
import process from 'node:process'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { createReleaseStepDefinitions } from './lib/release/plan'
import {
  createReleaseCommands,
  runLoggedCommand,
  runReleasePreflight,
  waitForNpmVersion,
} from './lib/release/runtime'
import type {
  ReleasePlan,
  ReleaseStepDefinition,
  ReleaseStepId,
  ReleaseStepStatus,
} from './lib/release/types'
import { loadReleasePlan } from './lib/release/workspace'

type StepState = ReleaseStepDefinition & {
  log: string[]
  status: ReleaseStepStatus
}

type RunState = 'running' | 'success' | 'failed'

const HOME_TAB_ID = '__home__'
const MAX_LOG_LINES = 4000
const STATUS_COLORS: Record<ReleaseStepStatus, RGBA> = {
  failed: RGBA.fromInts(248, 113, 113),
  pending: RGBA.fromInts(148, 163, 184),
  running: RGBA.fromInts(250, 204, 21),
  skipped: RGBA.fromInts(148, 163, 184),
  success: RGBA.fromInts(74, 222, 128),
}

function plainStyledText(content: string): StyledText {
  return new StyledText([{ __isChunk: true, text: content }])
}

function lineChunk(text: string, fg?: RGBA): TextChunk {
  return {
    __isChunk: true,
    text,
    fg,
  }
}

function appendLine(target: TextChunk[], chunks: TextChunk[]): void {
  if (target.length > 0) {
    target.push(lineChunk('\n'))
  }
  target.push(...chunks)
}

function formatStepStatus(status: ReleaseStepStatus): string {
  switch (status) {
    case 'failed':
      return 'FAILED'
    case 'running':
      return 'RUNNING'
    case 'skipped':
      return 'SKIPPED'
    case 'success':
      return 'DONE'
    default:
      return 'PENDING'
  }
}

function renderHomeSummary(
  plan: ReleasePlan | null,
  steps: StepState[],
  error: string | null
): StyledText {
  const chunks: TextChunk[] = []

  appendLine(chunks, [lineChunk('OpenSpec UI Release Orchestrator', RGBA.fromInts(226, 232, 240))])

  if (!plan) {
    appendLine(chunks, [lineChunk('Unable to build a release plan.', STATUS_COLORS.failed)])
    if (error) {
      appendLine(chunks, [lineChunk(error, STATUS_COLORS.failed)])
    }
    return new StyledText(chunks)
  }

  appendLine(chunks, [lineChunk(`Current openspecui version: ${plan.currentVersion}`)])
  appendLine(chunks, [lineChunk(`Previous release version: ${plan.previousVersion ?? 'none'}`)])
  appendLine(chunks, [lineChunk(`Baseline commit: ${plan.baselineCommit ?? 'none'}`)])
  appendLine(chunks, [lineChunk(`Changed files since baseline: ${plan.changedFiles.length}`)])
  appendLine(chunks, [lineChunk('')])
  appendLine(chunks, [lineChunk('Deploy decisions', RGBA.fromInts(148, 163, 184))])
  appendLine(chunks, [
    lineChunk(`Website: ${plan.website.required ? 'deploy' : 'skip'} - ${plan.website.reason}`),
  ])
  appendLine(chunks, [
    lineChunk(`App: ${plan.app.required ? 'deploy' : 'skip'} - ${plan.app.reason}`),
  ])
  appendLine(chunks, [
    lineChunk(
      `npm wait: ${plan.waitForNpm.required ? 'required' : 'skip'} - ${plan.waitForNpm.reason}`
    ),
  ])
  appendLine(chunks, [lineChunk('')])
  appendLine(chunks, [lineChunk('Steps', RGBA.fromInts(148, 163, 184))])

  for (const step of steps) {
    appendLine(chunks, [
      lineChunk(`[${formatStepStatus(step.status)}] `, STATUS_COLORS[step.status]),
      lineChunk(step.title),
    ])
    if (step.skipReason) {
      appendLine(chunks, [lineChunk(`  reason: ${step.skipReason}`, RGBA.fromInts(148, 163, 184))])
    } else {
      appendLine(chunks, [lineChunk(`  ${step.description}`, RGBA.fromInts(148, 163, 184))])
    }
  }

  if (error) {
    appendLine(chunks, [lineChunk('')])
    appendLine(chunks, [lineChunk(`Error: ${error}`, STATUS_COLORS.failed)])
  }

  return new StyledText(chunks)
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

function ReleaseApp({
  initialError,
  plan,
}: {
  initialError: string | null
  plan: ReleasePlan | null
}) {
  const renderer = useRenderer()
  const definitions = useMemo(() => (plan ? createReleaseStepDefinitions(plan) : []), [plan])
  const [steps, setSteps] = useState<StepState[]>(() =>
    definitions.map((step) => ({ ...step, log: [], status: 'pending' }))
  )
  const [activeTabId, setActiveTabId] = useState<string>(HOME_TAB_ID)
  const [runState, setRunState] = useState<RunState>(initialError ? 'failed' : 'running')
  const [error, setError] = useState<string | null>(initialError)

  const appendLog = useCallback((stepId: ReleaseStepId, line: string) => {
    setSteps((current) =>
      current.map((step) =>
        step.id === stepId
          ? {
              ...step,
              log: [...step.log, line].slice(-MAX_LOG_LINES),
            }
          : step
      )
    )
  }, [])

  const setStepStatus = useCallback((stepId: ReleaseStepId, status: ReleaseStepStatus) => {
    setSteps((current) => current.map((step) => (step.id === stepId ? { ...step, status } : step)))
  }, [])

  useEffect(() => {
    if (!plan || initialError) return

    let cancelled = false

    const run = async () => {
      for (const step of definitions) {
        if (cancelled) return

        if (step.skipReason) {
          appendLog(step.id, `skip: ${step.skipReason}`)
          setStepStatus(step.id, 'skipped')
          continue
        }

        setActiveTabId(step.id)
        setStepStatus(step.id, 'running')

        try {
          await runStepById(process.cwd(), plan, step.id, (line) => appendLog(step.id, line))
          if (cancelled) return
          setStepStatus(step.id, 'success')
        } catch (stepError) {
          const message = stepError instanceof Error ? stepError.message : String(stepError)
          appendLog(step.id, `error: ${message}`)
          setStepStatus(step.id, 'failed')
          setError(message)
          setRunState('failed')
          return
        }
      }

      if (!cancelled) {
        setActiveTabId(HOME_TAB_ID)
        setRunState('success')
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [appendLog, definitions, initialError, plan, setStepStatus])

  const tabIds = useMemo(() => [HOME_TAB_ID, ...steps.map((step) => step.id)], [steps])
  const activeStep = steps.find((step) => step.id === activeTabId)
  const tabOptions = useMemo<TabSelectOption<string>[]>(() => {
    const homeLabel =
      runState === 'failed' ? 'Home [failed]' : runState === 'success' ? 'Home [done]' : 'Home'
    return [
      {
        value: HOME_TAB_ID,
        label: homeLabel,
      },
      ...steps.map((step) => ({
        value: step.id,
        label: `${step.title} [${formatStepStatus(step.status).toLowerCase()}]`,
      })),
    ]
  }, [runState, steps])

  useKeyboard((key) => {
    if (key.name === 'q' || key.ctrl || key.name === 'escape') {
      renderer?.destroy()
      return
    }

    if (key.sequence === '`' || key.name === 'grave' || key.name === 'backtick') {
      setActiveTabId(HOME_TAB_ID)
      return
    }

    if (key.name === 'left' || key.name === 'right') {
      const currentIndex = Math.max(0, tabIds.indexOf(activeTabId))
      const nextIndex =
        key.name === 'left'
          ? (currentIndex - 1 + tabIds.length) % tabIds.length
          : (currentIndex + 1) % tabIds.length
      setActiveTabId(tabIds[nextIndex] ?? HOME_TAB_ID)
      return
    }

    const shortcut = Number.parseInt(key.sequence ?? '', 10)
    if (!Number.isNaN(shortcut) && shortcut >= 1 && shortcut <= steps.length) {
      setActiveTabId(steps[shortcut - 1]?.id ?? HOME_TAB_ID)
    }
  })

  const homeSummary = useMemo(() => renderHomeSummary(plan, steps, error), [error, plan, steps])
  const stepOutput = useMemo(() => {
    if (!activeStep) return plainStyledText('Select a step tab to inspect logs.')
    const header = [`${activeStep.title} (${formatStepStatus(activeStep.status)})`, '']
    return plainStyledText([...header, ...activeStep.log].join('\n'))
  }, [activeStep])

  return (
    <box width="100%" height="100%" padding={1} flexDirection="column">
      <box height={1} width="100%">
        <tab-select
          focused={false}
          width="100%"
          height={1}
          options={tabOptions as TabSelectRenderable<string>[]}
          tabWidth={22}
          showDescription={false}
          showUnderline={false}
          showScrollArrows
          wrapSelection
          backgroundColor="transparent"
          focusedBackgroundColor="transparent"
          textColor="#d1d5db"
          focusedTextColor="#d1d5db"
          selectedBackgroundColor="#d1d5db"
          selectedTextColor="#111827"
          onChange={(_, option) => {
            if (typeof option?.value === 'string') {
              setActiveTabId(option.value)
            }
          }}
        />
      </box>
      <box height={1}>
        <text>{'<-/->:tab  1-9:step tab  `:home  Q/Esc/Ctrl+C:quit'}</text>
      </box>
      <box height={1}>
        <text>{'─'.repeat(80)}</text>
      </box>
      <box flexGrow={1}>
        <scrollbox focused height="100%">
          <text content={activeTabId === HOME_TAB_ID ? homeSummary : stepOutput} />
        </scrollbox>
      </box>
    </box>
  )
}

let plan: ReleasePlan | null = null
let initialError: string | null = null

try {
  plan = loadReleasePlan(process.cwd())
} catch (error) {
  initialError = error instanceof Error ? error.message : String(error)
}

const renderer = await createCliRenderer({ exitOnCtrlC: false })
createRoot(renderer).render(<ReleaseApp plan={plan} initialError={initialError} />)
