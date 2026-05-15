import { parseOpenSpecMarkdownToSpec } from './openspec-projection.js'
import type {
  Change,
  Delta,
  DeltaOperation,
  DeltaSpec,
  Requirement,
  ScenarioStep,
  Spec,
  Task,
} from './schemas.js'

type ParsedScenario = Requirement['scenarios'][number]

const SCENARIO_STEP_KEYWORDS = ['GIVEN', 'WHEN', 'THEN', 'AND', 'BUT'] as const
const SCENARIO_STEP_PATTERN = new RegExp(
  `^\\s*[-*+]\\s+(?:\\*\\*)?(${SCENARIO_STEP_KEYWORDS.join('|')})\\b(?:\\*\\*)?\\s*:?\\s*(.+?)\\s*$`,
  'i'
)

function parseScenarioSteps(bodyMarkdown: string): ScenarioStep[] {
  const steps: ScenarioStep[] = []

  for (const line of bodyMarkdown.split('\n')) {
    const match = line.match(SCENARIO_STEP_PATTERN)
    if (!match) continue

    const keyword = match[1]!.toUpperCase() as ScenarioStep['keyword']
    steps.push({
      keyword,
      contentMarkdown: match[2]!.trim(),
      rawText: line.trim(),
    })
  }

  return steps
}

/**
 * Markdown parser for OpenSpec documents
 */
export class MarkdownParser {
  /**
   * Parse a spec markdown content into a Spec object
   */
  parseSpec(specId: string, content: string): Spec {
    return parseOpenSpecMarkdownToSpec(specId, content)
  }

  /**
   * Parse a change proposal markdown content into a Change object
   */
  parseChange(
    changeId: string,
    proposalContent: string,
    tasksContent: string = '',
    options?: { design?: string; deltaSpecs?: DeltaSpec[] }
  ): Change {
    const lines = proposalContent.split('\n')
    let name = changeId
    let why = ''
    let whatChanges = ''
    const deltas: Delta[] = []

    let currentSection = ''

    for (const line of lines) {
      if (line.startsWith('# ')) {
        name = line.slice(2).trim()
        continue
      }

      if (line.startsWith('## ')) {
        const sectionTitle = line.slice(3).trim().toLowerCase()
        if (sectionTitle.includes('why')) {
          currentSection = 'why'
        } else if (sectionTitle.includes('what') || sectionTitle.includes('change')) {
          currentSection = 'whatChanges'
        } else if (sectionTitle.includes('impact') || sectionTitle.includes('delta')) {
          currentSection = 'impact'
        } else {
          currentSection = sectionTitle
        }
        continue
      }

      if (currentSection === 'why') {
        why += line + '\n'
      } else if (currentSection === 'whatChanges') {
        whatChanges += line + '\n'
      } else if (currentSection === 'impact') {
        const specMatch = line.match(/specs\/([a-zA-Z0-9-_]+)/)
        if (specMatch) {
          deltas.push({
            spec: specMatch[1],
            operation: 'MODIFIED',
            description: line.trim(),
          })
        }
      }
    }

    const tasks = this.parseTasks(tasksContent)

    const deltasFromDeltaSpecs = this.parseDeltasFromDeltaSpecs(options?.deltaSpecs)
    const deltasFromWhatChanges = this.parseDeltasFromWhatChanges(whatChanges)

    const combinedDeltas = deltasFromDeltaSpecs.length > 0 ? deltasFromDeltaSpecs : deltas
    const finalDeltas = combinedDeltas.length > 0 ? combinedDeltas : deltasFromWhatChanges

    return {
      id: changeId,
      name: name || changeId,
      why: why.trim(),
      whatChanges: whatChanges.trim(),
      deltas: finalDeltas,
      tasks,
      progress: {
        total: tasks.length,
        completed: tasks.filter((t) => t.completed).length,
      },
      design: options?.design,
      deltaSpecs: options?.deltaSpecs,
    }
  }

  private parseDeltasFromWhatChanges(whatChanges: string): Delta[] {
    if (!whatChanges.trim()) return []
    const deltas: Delta[] = []
    const lines = whatChanges.split('\n')

    for (const line of lines) {
      const match = line.match(/^\s*-\s*\*\*([^*:]+)(?::\*\*|\*\*:):?\s*(.+)$/)
      if (!match) continue

      const spec = match[1].trim()
      const description = match[2].trim()
      const lower = description.toLowerCase()

      let operation: DeltaOperation = 'MODIFIED'
      if (/\brename(s|d|ing)?\b/.test(lower) || /\brenamed\b/.test(lower)) {
        operation = 'RENAMED'
      } else if (/\bremove(s|d|ing)?\b/.test(lower) || /\bdelete(s|d|ing)?\b/.test(lower)) {
        operation = 'REMOVED'
      } else if (
        /\badd(s|ed|ing)?\b/.test(lower) ||
        /\bcreate(s|d|ing)?\b/.test(lower) ||
        /\bnew\b/.test(lower)
      ) {
        operation = 'ADDED'
      }

      deltas.push({ spec, operation, description })
    }

    return deltas
  }

  private parseDeltasFromDeltaSpecs(deltaSpecs?: DeltaSpec[]): Delta[] {
    if (!deltaSpecs || deltaSpecs.length === 0) return []
    return deltaSpecs.flatMap((deltaSpec) => this.parseDeltaSpecContent(deltaSpec))
  }

  private parseDeltaSpecContent(deltaSpec: DeltaSpec): Delta[] {
    const deltas: Delta[] = []
    const lines = deltaSpec.content.split('\n')

    let currentOperation: DeltaOperation | null = null
    let currentRequirement: {
      title: string
      descriptionLines: string[]
      scenarios: Array<{ title: string; lines: string[] }>
    } | null = null
    let renameBuffer: { from?: string; to?: string } | null = null
    let reqIndex = 0

    const finalizeRequirement = () => {
      if (!currentOperation || !currentRequirement) return
      const scenarios = currentRequirement.scenarios.reduce<ParsedScenario[]>((acc, scenario) => {
        const bodyMarkdown = scenario.lines.join('\n').trim()
        const rawText = [scenario.title, bodyMarkdown].filter((part) => part.trim()).join('\n')
        if (rawText) {
          acc.push({
            title: scenario.title,
            bodyMarkdown,
            rawText,
            steps: parseScenarioSteps(bodyMarkdown),
          })
        }
        return acc
      }, [])

      const bodyMarkdown = currentRequirement.descriptionLines.join('\n').trim()
      const text = [currentRequirement.title, bodyMarkdown, ...scenarios.map((s) => s.rawText)]
        .filter((part) => part.trim())
        .join('\n\n')

      const requirement: Requirement = {
        id: `${deltaSpec.specId}-${currentOperation.toLowerCase()}-${++reqIndex}`,
        title: currentRequirement.title,
        bodyMarkdown,
        text,
        scenarios,
      }

      deltas.push({
        spec: deltaSpec.specId,
        operation: currentOperation,
        description: `${currentOperation} requirement: ${requirement.text}`,
        requirement,
        requirements: [requirement],
      })
    }

    for (const rawLine of lines) {
      const line = rawLine.trimEnd()

      const opMatch = line.match(/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements/i)
      if (opMatch) {
        finalizeRequirement()
        currentRequirement = null
        currentOperation = opMatch[1].toUpperCase() as DeltaOperation
        renameBuffer = null
        continue
      }

      if (currentOperation === 'RENAMED') {
        const fromMatch = line.match(/FROM:\s*`?###\s*Requirement:\s*(.+?)`?$/i)
        const toMatch = line.match(/TO:\s*`?###\s*Requirement:\s*(.+?)`?$/i)
        if (fromMatch) {
          if (!renameBuffer) {
            renameBuffer = {}
          }
          renameBuffer.from = fromMatch[1].trim()
        }
        if (toMatch) {
          if (!renameBuffer) {
            renameBuffer = {}
          }
          renameBuffer.to = toMatch[1].trim()
        }
        if (renameBuffer?.from && renameBuffer?.to) {
          deltas.push({
            spec: deltaSpec.specId,
            operation: 'RENAMED',
            description: `Rename requirement from "${renameBuffer.from}" to "${renameBuffer.to}"`,
            rename: { from: renameBuffer.from, to: renameBuffer.to },
          })
          renameBuffer = null
        }
        continue
      }

      const requirementMatch = line.match(/^###\s+Requirement:\s*(.+)$/)
      if (requirementMatch) {
        finalizeRequirement()
        currentRequirement = {
          title: requirementMatch[1].trim(),
          descriptionLines: [],
          scenarios: [],
        }
        continue
      }

      const scenarioMatch = line.match(/^####\s*Scenario:?\s*(.*)$/)
      if (scenarioMatch && currentRequirement) {
        const title = scenarioMatch[1].trim() || 'Scenario'
        currentRequirement.scenarios.push({ title, lines: [] })
        continue
      }

      if (currentRequirement) {
        const activeScenario = currentRequirement.scenarios[currentRequirement.scenarios.length - 1]
        if (activeScenario) {
          activeScenario.lines.push(line)
        } else {
          currentRequirement.descriptionLines.push(line)
        }
      }
    }

    finalizeRequirement()

    return deltas
  }

  /**
   * Parse tasks from a tasks.md content
   */
  parseTasks(content: string): Task[] {
    if (!content) return []

    const tasks: Task[] = []
    const lines = content.split('\n')
    let currentSection = ''
    let taskIndex = 0

    for (const line of lines) {
      if (line.startsWith('## ')) {
        currentSection = line.slice(3).trim()
        continue
      }

      const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/)
      if (taskMatch) {
        taskIndex++
        tasks.push({
          id: `task-${taskIndex}`,
          text: taskMatch[2].trim(),
          completed: taskMatch[1].toLowerCase() === 'x',
          section: currentSection || undefined,
        })
      }
    }

    return tasks
  }

  /**
   * Serialize a spec back to markdown
   */
  serializeSpec(spec: Spec): string {
    let content = `# ${spec.name}\n\n`
    content += `## Purpose\n${spec.overview}\n\n`
    content += `## Requirements\n`

    for (const req of spec.requirements) {
      content += `\n### Requirement: ${req.title}\n`
      if (req.bodyMarkdown.trim()) {
        content += `${req.bodyMarkdown.trim()}\n`
      }
      for (const scenario of req.scenarios) {
        content += `\n#### Scenario: ${scenario.title}\n`
        if (scenario.bodyMarkdown.trim()) {
          content += `${scenario.bodyMarkdown.trim()}\n`
        }
      }
    }

    return content
  }
}
