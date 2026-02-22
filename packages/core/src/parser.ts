import type {
  Change,
  Delta,
  DeltaOperation,
  DeltaSpec,
  Requirement,
  Spec,
  Task,
} from './schemas.js'

/**
 * Markdown parser for OpenSpec documents
 */
export class MarkdownParser {
  /**
   * Parse a spec markdown content into a Spec object
   */
  parseSpec(specId: string, content: string): Spec {
    const lines = content.split('\n')
    let name = specId
    let overview = ''
    const requirements: Requirement[] = []

    let currentSection = ''
    let currentRequirement: Partial<Requirement> | null = null
    let currentScenarioText = ''
    let reqIndex = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Parse title (# heading)
      if (line.startsWith('# ') && name === specId) {
        name = line.slice(2).trim()
        continue
      }

      // Parse section headers (## heading)
      if (line.startsWith('## ')) {
        const sectionTitle = line.slice(3).trim().toLowerCase()
        if (sectionTitle.includes('purpose') || sectionTitle.includes('overview')) {
          currentSection = 'overview'
        } else if (sectionTitle.includes('requirement')) {
          currentSection = 'requirements'
        } else {
          currentSection = sectionTitle
        }
        continue
      }

      // Parse requirements (### Requirement: ...)
      if (
        line.startsWith('### Requirement:') ||
        (line.startsWith('### ') && currentSection === 'requirements')
      ) {
        if (currentRequirement) {
          if (currentScenarioText.trim()) {
            currentRequirement.scenarios = currentRequirement.scenarios || []
            currentRequirement.scenarios.push({ rawText: currentScenarioText.trim() })
          }
          requirements.push({
            id: currentRequirement.id || `req-${reqIndex}`,
            text: currentRequirement.text || '',
            scenarios: currentRequirement.scenarios || [],
          })
        }
        reqIndex++
        const reqTitle = line.replace(/^###\s*(Requirement:\s*)?/, '').trim()
        currentRequirement = {
          id: `req-${reqIndex}`,
          text: reqTitle,
          scenarios: [],
        }
        currentScenarioText = ''
        continue
      }

      // Parse scenarios (#### Scenario: ...)
      if (line.startsWith('#### Scenario:') || line.startsWith('#### ')) {
        if (currentScenarioText.trim() && currentRequirement) {
          currentRequirement.scenarios = currentRequirement.scenarios || []
          currentRequirement.scenarios.push({ rawText: currentScenarioText.trim() })
        }
        currentScenarioText = line.replace(/^####\s*(Scenario:\s*)?/, '').trim() + '\n'
        continue
      }

      // Accumulate content
      if (currentSection === 'overview' && !currentRequirement) {
        overview += line + '\n'
      } else if (currentRequirement && line.trim()) {
        if (line.startsWith('- ') || line.startsWith('* ')) {
          currentScenarioText += line + '\n'
        } else if (!line.startsWith('#')) {
          if (currentRequirement.text && !currentScenarioText) {
            currentRequirement.text += ' ' + line.trim()
          } else {
            currentScenarioText += line + '\n'
          }
        }
      }
    }

    // Finalize last requirement
    if (currentRequirement) {
      if (currentScenarioText.trim()) {
        currentRequirement.scenarios = currentRequirement.scenarios || []
        currentRequirement.scenarios.push({ rawText: currentScenarioText.trim() })
      }
      requirements.push({
        id: currentRequirement.id || `req-${reqIndex}`,
        text: currentRequirement.text || '',
        scenarios: currentRequirement.scenarios || [],
      })
    }

    return {
      id: specId,
      name: name || specId,
      overview: overview.trim(),
      requirements,
      metadata: {
        version: '1.0.0',
        format: 'openspec',
      },
    }
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
      const scenarios = currentRequirement.scenarios
        .map((scenario) => {
          const rawText = [scenario.title, ...scenario.lines].join('\n').trim()
          return rawText ? { rawText } : null
        })
        .filter((s): s is { rawText: string } => Boolean(s))

      const descriptionText = currentRequirement.descriptionLines
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')

      const requirement: Requirement = {
        id: `${deltaSpec.specId}-${currentOperation.toLowerCase()}-${++reqIndex}`,
        text: descriptionText || currentRequirement.title,
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
      content += `\n### Requirement: ${req.text}\n`
      for (const scenario of req.scenarios) {
        content += `\n#### Scenario\n${scenario.rawText}\n`
      }
    }

    return content
  }
}
