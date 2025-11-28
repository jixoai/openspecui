import type { Spec, Requirement, Change, Delta, Task } from './schemas.js'

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
      if (line.startsWith('### Requirement:') || (line.startsWith('### ') && currentSection === 'requirements')) {
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
  parseChange(changeId: string, proposalContent: string, tasksContent: string = ''): Change {
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

    return {
      id: changeId,
      name: name || changeId,
      why: why.trim(),
      whatChanges: whatChanges.trim(),
      deltas,
      tasks,
      progress: {
        total: tasks.length,
        completed: tasks.filter((t) => t.completed).length,
      },
    }
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
